/**
 * Gyroclopter: A LAN-based air mouse using mobile gyroscopes.
 * 
 * Features:
 * - Low-latency mouse control via WebSocket.
 * - Automatic self-signed SSL certificate generation for secure sensor access.
 * - Native Windows mouse injection via PowerShell (zero native Node dependencies).
 * - Terminal-based QR code for easy mobile pairing.
 */

// Force a console window on Windows when run directly.
if (require.main === module && process.platform === 'win32' && !process.env.IS_CHILD) {
    const { spawn } = require('child_process');
    const path = require('path');
    const fs = require('fs');
    const os = require('os');
    // Write a temporary .bat file to avoid fragile multi-level quoting
    // when passing paths with spaces through cmd /c start cmd /k.
    const childArgv = [process.argv[0], ...process.argv.slice(1)];
    const cmdLine = childArgv
        .map(a => (a.indexOf(' ') >= 0 ? `"${a}"` : a))
        .join(' ');
    const batPath = path.join(os.tmpdir(), `gyroclopter-${process.pid}.bat`);
    fs.writeFileSync(batPath, `@chcp 65001 >nul\r\n@${cmdLine}\r\n@del "%~f0"\r\n`);
    spawn('cmd', ['/c', 'start', 'cmd', '/k', batPath], {
        detached: true,
        stdio: 'ignore',
        env: { ...process.env, IS_CHILD: 'true' }
    });
    process.exit();
}

const fs = require('fs');
const path = require('path');
const https = require('https');
const os = require('os');
const { spawn } = require('child_process');
const WebSocket = require('ws');
const QRCode = require('qrcode');
const selfsigned = require('selfsigned');

const CONFIG = {
    PORT: 8443,
    APP_DIR: path.join(os.tmpdir(), 'gyroclopter'),
    MOUSE_SENSITIVITY_MULTIPLIER: 1.2
};

/**
 * Ensures the application directory exists.
 */
function ensureAppDir() {
    // Allow overriding the application directory via the CERT_DIR environment variable for testing/custom deployments.
    const appDir = process.env.CERT_DIR || CONFIG.APP_DIR;
    if (!fs.existsSync(appDir)) {
        fs.mkdirSync(appDir, { recursive: true });
    }
}

/**
 * Checks whether a buffer/string looks like a PEM-encoded key or certificate.
 */
function looksLikePem(data) {
    const text = data.toString();
    return text.includes('-----BEGIN') && text.includes('-----END');
}

/**
 * Retrieves existing SSL certificates or generates new ones.
 * Required for mobile browsers to allow access to DeviceOrientation events.
 */
async function getCertificates() {
    const certDir = process.env.CERT_DIR || CONFIG.APP_DIR;
    const keyPath = path.join(certDir, 'key.pem');
    const certPath = path.join(certDir, 'cert.pem');
    // If both files exist and contain valid-looking PEM data, read and return them.
    if (fs.existsSync(keyPath) && fs.existsSync(certPath)) {
        const key = fs.readFileSync(keyPath);
        const cert = fs.readFileSync(certPath);
        if (looksLikePem(key) && looksLikePem(cert)) {
            return { key, cert };
        }
    }
    console.log('\x1b[33m%s\x1b[0m', '🛡️  Generating self-signed SSL certificates for Gyroclopter...');
    // Generate real self-signed certificates using selfsigned library
    const attrs = [{ name: 'commonName', value: 'Gyroclopter' }];
    const pems = await selfsigned.generate(attrs, { days: 365 });
    fs.writeFileSync(keyPath, pems.private);
    fs.writeFileSync(certPath, pems.cert);
    return {
        key: pems.private,
        cert: pems.cert
    };
}

/**
 * Windows-specific mouse controller using PowerShell and P/Invoke.
 *
 * The script is written to a temporary .ps1 file and executed with
 * `-File` so PowerShell keeps stdin open for the command loop. The
 * script announces "READY" on stdout once the P/Invoke type is loaded
 * and the command loop is running; commands are only forwarded after
 * that signal arrives to avoid losing them during startup.
 */
class WindowsMouseController {
    constructor() {
        this.process = null;
        this.ready = false;
        this.queue = [];
        this.scriptPath = null;
        if (os.platform() === 'win32') {
            this.init();
        }
    }

    buildScript() {
        return [
            '$ErrorActionPreference = \'Stop\'',
            'try {',
            '  Add-Type -Namespace Gyroclopter -Name WinMouse -MemberDefinition @\'',
            '[DllImport("user32.dll")]',
            'public static extern void mouse_event(int dwFlags, int dx, int dy, int dwData, int dwExtraInfo);',
            '\'@',
            '  [Console]::Out.WriteLine("READY")',
            '  [Console]::Out.Flush()',
            '  while ($true) {',
            '    $line = [Console]::In.ReadLine()',
            '    if ($null -eq $line) { break }',
            '    if ($line -eq \'exit\') { break }',
            '    try {',
            '      $parts = $line -split \' \'',
            '      switch ($parts[0]) {',
            '        \'MOVE\'        { [Gyroclopter.WinMouse]::mouse_event(0x0001, [int]$parts[1], [int]$parts[2], 0, 0) }',
            '        \'LEFT_DOWN\'   { [Gyroclopter.WinMouse]::mouse_event(0x0002, 0, 0, 0, 0) }',
            '        \'LEFT_UP\'     { [Gyroclopter.WinMouse]::mouse_event(0x0004, 0, 0, 0, 0) }',
            '        \'CLICK_RIGHT\' { [Gyroclopter.WinMouse]::mouse_event(0x0008 -bor 0x0010, 0, 0, 0, 0) }',
            '        \'SCROLL\'      { [Gyroclopter.WinMouse]::mouse_event(0x0800, 0, 0, [int]$parts[1], 0) }',
            '      }',
            '    } catch {',
            '      [Console]::Error.WriteLine(("ERR " + $_.Exception.Message))',
            '    }',
            '  }',
            '} catch {',
            '  [Console]::Error.WriteLine(("STARTUP_ERR " + $_.Exception.Message))',
            '  exit 1',
            '}',
            ''
        ].join('\r\n');
    }

    init() {
        try {
            const script = this.buildScript();
            this.scriptPath = path.join(os.tmpdir(), `gyroclopter-mouse-${process.pid}.ps1`);
            fs.writeFileSync(this.scriptPath, script, 'utf8');
        } catch (err) {
            console.error('Failed to write Windows Mouse Controller script:', err);
            return;
        }

        this.process = spawn('powershell.exe', [
            '-NoProfile',
            '-ExecutionPolicy', 'Bypass',
            '-File', this.scriptPath
        ], {
            stdio: ['pipe', 'pipe', 'pipe'],
            windowsHide: true
        });

        this.process.on('error', (err) => {
            console.error('Failed to start Windows Mouse Controller:', err);
            this.ready = false;
        });

        this.process.stderr.on('data', (chunk) => {
            const msg = chunk.toString();
            if (msg.startsWith('STARTUP_ERR')) {
                console.error('Windows Mouse Controller startup failed:', msg);
                this.ready = false;
            } else if (msg.startsWith('ERR ')) {
                console.error('Windows Mouse Controller command error:', msg);
            }
        });

        this.process.on('exit', (code, signal) => {
            this.ready = false;
            this.process = null;
        });

        let stdoutBuffer = '';
        this.process.stdout.on('data', (chunk) => {
            stdoutBuffer += chunk.toString();
            let idx;
            while ((idx = stdoutBuffer.indexOf('\n')) !== -1) {
                const line = stdoutBuffer.slice(0, idx).trim();
                stdoutBuffer = stdoutBuffer.slice(idx + 1);
                if (line === 'READY') {
                    this.ready = true;
                    const pending = this.queue;
                    this.queue = [];
                    for (const cmd of pending) {
                        this.sendCommand(cmd);
                    }
                }
            }
        });
    }

    sendCommand(cmd) {
        if (!this.process || !this.process.stdin || !this.process.stdin.writable) {
            return;
        }
        if (!this.ready) {
            this.queue.push(cmd);
            if (this.queue.length > 256) {
                this.queue.shift();
            }
            return;
        }
        this.process.stdin.write(cmd + '\n');
    }

    dispose() {
        if (this.process) {
            try {
                if (this.process.stdin && this.process.stdin.writable) {
                    this.process.stdin.write('exit\n');
                }
            } catch (_) { /* ignore */ }
            try {
                this.process.kill();
            } catch (_) { /* ignore */ }
            this.process = null;
        }
        if (this.scriptPath) {
            try { fs.unlinkSync(this.scriptPath); } catch (_) { /* ignore */ }
            this.scriptPath = null;
        }
        this.ready = false;
        this.queue = [];
    }
}

class LinuxMouseController {
    constructor() {
        const session = process.env.XDG_SESSION_TYPE || (process.env.DISPLAY ? 'x11' : 'unknown');
        this.session = session;
        this.cmd = null;
        if (session === 'x11') {
            this.cmd = 'xdotool';
        } else if (session === 'wayland') {
            this.cmd = 'ydotool';
        } else {
            console.warn('LinuxMouseController: Unknown session type, mouse control may not work');
        }
    }

    sendCommand(cmd) {
        if (!this.cmd) return;
        const parts = cmd.split(' ');
        const type = parts[0];
        const exec = require('child_process').exec;

        if (type === 'MOVE') {
            const dx = parts[1];
            const dy = parts[2];
            const command = this.cmd === 'xdotool'
                ? `xdotool mousemove_relative --sync ${dx} ${dy}`
                : `ydotool mousemove -r -- ${dx} ${dy}`;
            exec(command, (err) => { if (err) console.error('Mouse move error', err); });

        } else if (type === 'LEFT_DOWN') {
            const command = this.cmd === 'xdotool' ? 'xdotool mousedown 1' : 'ydotool click 0x40';
            exec(command);

        } else if (type === 'LEFT_UP') {
            const command = this.cmd === 'xdotool' ? 'xdotool mouseup 1' : 'ydotool click 0x80';
            exec(command);

        } else if (type === 'CLICK_RIGHT') {
            const command = this.cmd === 'xdotool' ? 'xdotool click 3' : 'ydotool click 0xC1';
            exec(command);

        } else if (type === 'SCROLL') {
            const delta = parseInt(parts[1], 10);
            let command;
            if (this.cmd === 'xdotool') {
                command = delta > 0 ? 'xdotool click 4' : 'xdotool click 5';
            } else {
                const scrollY = delta > 0 ? -3 : 3;
                command = `ydotool mousemove --wheel -x 0 -y ${scrollY}`;
            }
            exec(command);
        }
    }

    dispose() {
        // No persistent process
    }
}

// Generic controller that auto-switches based on OS and session
class GenericMouseController {
    constructor() {
        if (os.platform() === 'win32') {
            this.controller = new WindowsMouseController();
        } else {
            this.controller = new LinuxMouseController();
        }
    }
    sendCommand(cmd) {
        if (this.controller && typeof this.controller.sendCommand === 'function') {
            this.controller.sendCommand(cmd);
        }
    }
    dispose() {
        if (this.controller && typeof this.controller.dispose === 'function') {
            this.controller.dispose();
        }
    }
}

/**
 * Finds the local IPv4 address for LAN access.
 */
function getLocalIp() {
    const interfaces = os.networkInterfaces();
    for (const name of Object.keys(interfaces)) {
        for (const iface of interfaces[name]) {
            if (iface.family === 'IPv4' && !iface.internal) {
                return iface.address;
            }
        }
    }
    return '127.0.0.1';
}

/**
 * Retrieves the client HTML from the client.html file.
 */
function getClientHtml() {
    const htmlPath = path.join(__dirname, 'client.html');
    return fs.readFileSync(htmlPath, 'utf8');
}

/**
 * Main application entry point.
 */
async function main() {
    ensureAppDir();
    
    const certificates = await getCertificates();
    const mouse = new GenericMouseController();

    const server = https.createServer(certificates, (req, res) => {
        res.writeHead(200, { 'Content-Type': 'text/html' });
        res.end(getClientHtml());
    });

    const wss = new WebSocket.Server({ server });

    wss.on('connection', (ws) => {
        ws.on('message', (message) => {
            try {
                const data = JSON.parse(message);
                switch (data.type) {
                    case 'move':
                        const dx = Math.round(data.dx * CONFIG.MOUSE_SENSITIVITY_MULTIPLIER);
                        const dy = Math.round(data.dy * CONFIG.MOUSE_SENSITIVITY_MULTIPLIER);
                        mouse.sendCommand(`MOVE ${dx} ${dy}`);
                        break;
                    case 'down':
                        mouse.sendCommand('LEFT_DOWN');
                        break;
                    case 'up':
                        mouse.sendCommand('LEFT_UP');
                        break;
                    case 'right':
                        mouse.sendCommand('CLICK_RIGHT');
                        break;
                    case 'scroll':
                        mouse.sendCommand(`SCROLL ${data.delta}`);
                        break;
                }
            } catch (err) {
                // Ignore parsing errors
            }
        });
    });

    const localIp = getLocalIp();
    const url = `https://${localIp}:${CONFIG.PORT}`;

    server.listen(CONFIG.PORT, '0.0.0.0', async () => {
        console.clear();
        console.log('\x1b[36m%s\x1b[0m', '🚀 Gyroclopter Server Started');
        console.log('\x1b[90m%s\x1b[0m', '--------------------------------------------------');
        console.log(`URL: \x1b[4m${url}\x1b[0m\n`);

        try {
            const qr = await QRCode.toString(url, {
                type: 'terminal',
                small: true,
                errorCorrectionLevel: 'M'
            });
            console.log(qr);
            console.log('\x1b[90m' + url + '\x1b[0m');
        } catch (err) {
            console.log('Could not generate QR code in terminal.');
        }

        console.log('\x1b[33mInstructions:\x1b[0m');
        console.log('1. Connect your phone to the same Wi-Fi network.');
        console.log('2. Scan the QR code or enter the URL manually.');
        console.log('3. Accept the self-signed certificate warning in your browser.');
        console.log('4. Keep the browser tab open and active.');
        console.log('\n\x1b[90mPress Ctrl+C to stop the server.\x1b[0m');
    });

    // Graceful shutdown
    const shutdown = () => {
        console.log('\nShutting down Gyroclopter...');
        mouse.dispose();
        process.exit();
    };

    process.on('SIGINT', shutdown);
    process.on('SIGTERM', shutdown);
}

// Only start the server if run directly (not when required as a module)
if (require.main === module) {
  main();
}

module.exports = {
  getCertificates,
  ensureAppDir,
  getLocalIp,
  CONFIG
};