/**
 * Gyroclopter: A LAN-based air mouse using mobile gyroscopes.
 *
 * When spawned as a child process by the Neutralino desktop app, this server
 * communicates its status as JSON lines on stdout. The Neutralino parent parses
 * those lines to drive the desktop UI (QR code, connection count, etc.).
 *
 * Features:
 * - Low-latency mouse control via WebSocket.
 * - Automatic self-signed SSL certificate generation for secure sensor access.
 * - Native Windows mouse injection via PowerShell (zero native Node dependencies).
 * - JSON stdout protocol for headless operation under Neutralino.
 */

// Force a console window on Windows when run directly (not as Neutralino child).
// We write a tiny .bat launcher to a known path and `start` it with an explicit
// empty window title. Passing the bat path as the second quoted arg of `start`
// (not the third) is required: `start "<title>" "<command>"` is the only form
// that survives paths with spaces. The previous form `cmd /c start cmd /k <path>`
// fails with "The batch file cannot be found" because `start` interprets its
// first quoted arg as a title and drops the rest.
if (require.main === module && process.platform === 'win32' && !process.env.IS_CHILD && !process.env.IS_NEUTRALINO_CHILD) {
    const { spawn } = require('child_process');
    const path = require('path');
    const fs = require('fs');
    const os = require('os');
    const childArgv = [process.argv[0], ...process.argv.slice(1)];
    const cmdLine = childArgv
        .map(a => (a.indexOf(' ') >= 0 ? `"${a}"` : a))
        .join(' ');
    const batPath = path.join(os.tmpdir(), `gyroclopter-${process.pid}.bat`);
    fs.writeFileSync(batPath, `@chcp 65001 >nul
\n@${cmdLine}
\n@del "%~f0"
\n`);
    spawn('cmd', ['/c', 'start', '""', batPath], {
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
 *
 * Ensures the cert directory exists before reading or writing so callers can pass
 * a CERT_DIR that doesn't yet exist without triggering ENOENT.
 */
async function getCertificates() {
    ensureAppDir();
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
 * Writes a single JSON status line to stdout, terminated with a newline,
 * and forces a flush so the Neutralino parent never sees a partial line
 * (stdout is fully buffered when piped on Windows).
 */
function emitStatus(obj) {
    process.stdout.write(JSON.stringify(obj) + '\n');
}

/**
 * Retrieves the client HTML from the client.html file. Cached on first read
 * to avoid sync I/O on every HTTPS request (which would block the event loop
 * under load).
 */
let clientHtmlCache = null;
function getClientHtml() {
    if (clientHtmlCache === null) {
        const htmlPath = path.join(__dirname, 'client.html');
        clientHtmlCache = fs.readFileSync(htmlPath, 'utf8');
    }
    return clientHtmlCache;
}

/**
 * Returns true if value is a finite number. Used to reject garbage WS payloads
 * that would otherwise become "NaN" commands piped to PowerShell/xdotool.
 */
function isFiniteNumber(v) {
    return typeof v === 'number' && Number.isFinite(v);
}

/**
 * Dispatches a parsed WebSocket message to the mouse controller.
 *
 * Validates the payload, applies the sensitivity multiplier, and translates
 * high-level message types into the controller's command strings
 * (MOVE, LEFT_DOWN, LEFT_UP, CLICK_RIGHT, SCROLL). Returns true if the
 * message produced a controller command, false if it was rejected as
 * invalid or ignored as unknown.
 *
 * Extracted from main() so the protocol contract is unit-testable
 * without spinning up a real WebSocket server.
 */
function handleWsMessage(data, mouse) {
    if (!data || typeof data.type !== 'string') return false;

    switch (data.type) {
        case 'move':
            if (!isFiniteNumber(data.dx) || !isFiniteNumber(data.dy)) return false;
            {
                const dx = Math.round(data.dx * CONFIG.MOUSE_SENSITIVITY_MULTIPLIER);
                const dy = Math.round(data.dy * CONFIG.MOUSE_SENSITIVITY_MULTIPLIER);
                mouse.sendCommand(`MOVE ${dx} ${dy}`);
            }
            return true;
        case 'down':
            mouse.sendCommand('LEFT_DOWN');
            return true;
        case 'up':
            mouse.sendCommand('LEFT_UP');
            return true;
        case 'right':
            mouse.sendCommand('CLICK_RIGHT');
            return true;
        case 'scroll':
            if (!isFiniteNumber(data.delta)) return false;
            mouse.sendCommand(`SCROLL ${Math.trunc(data.delta)}`);
            return true;
        default:
            return false;
    }
}

/**
 * Main application entry point.
 * Communicates with the Neutralino parent via JSON lines on stdout.
 *
 * Fatal startup errors (EADDRINUSE, cert generation failure, etc.) are reported
 * via a `{"event":"error", ...}` JSON line so the parent can surface them in the
 * UI rather than seeing an unexplained child-process exit.
 */
async function main() {
    try {
        ensureAppDir();
        const certificates = await getCertificates();
        const mouse = new GenericMouseController();

        let connectedCount = 0;

        const server = https.createServer(certificates, (req, res) => {
            res.writeHead(200, { 'Content-Type': 'text/html' });
            res.end(getClientHtml());
        });

        const wss = new WebSocket.Server({ server });

        // EADDRINUSE etc. must be caught here, otherwise Node throws
        // "Unhandled 'error' event" and the process exits without telling the
        // Neutralino parent what happened.
        server.on('error', (err) => {
            emitStatus({ event: 'error', code: err.code || 'LISTEN_ERROR', message: err.message });
            mouse.dispose();
            process.exit(1);
        });
        wss.on('error', (err) => {
            emitStatus({ event: 'error', code: err.code || 'WSS_ERROR', message: err.message });
        });

        wss.on('connection', (ws) => {
            connectedCount++;
            emitStatus({ event: 'connection', count: connectedCount });

            ws.on('error', (err) => {
                // Per-socket errors are not fatal; log a status line for diagnostics.
                emitStatus({ event: 'socket_error', message: err.message });
            });

            ws.on('message', (message) => {
                            let data;
                            try {
                                data = JSON.parse(message);
                            } catch (_) {
                                return; // Ignore malformed JSON.
                            }
                            handleWsMessage(data, mouse);
                        });

            ws.on('close', () => {
                connectedCount = Math.max(0, connectedCount - 1);
                emitStatus({ event: 'disconnection', count: connectedCount });
            });
        });

        const localIp = getLocalIp();
        const url = `https://${localIp}:${CONFIG.PORT}`;

        server.listen(CONFIG.PORT, '0.0.0.0', async () => {
            let qr = '';
            try {
                qr = await QRCode.toDataURL(url, {
                    errorCorrectionLevel: 'M',
                    margin: 1,
                    width: 400
                });
            } catch (_) { /* QR generation failed silently */ }

            emitStatus({
                event: 'started',
                ip: localIp,
                port: CONFIG.PORT,
                qr: qr
            });
        });

        const shutdown = () => {
            mouse.dispose();
            process.exit(0);
        };

        process.on('SIGINT', shutdown);
        process.on('SIGTERM', shutdown);
    } catch (err) {
        // Anything thrown during startup (cert generation, etc.) reaches here
        // and is reported as a structured event before the process exits.
        emitStatus({
            event: 'error',
            code: err && err.code ? err.code : 'STARTUP_ERROR',
            message: err && err.message ? err.message : String(err)
        });
        process.exit(1);
    }
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