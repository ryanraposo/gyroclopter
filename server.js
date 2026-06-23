/**
 * Gyroclopter: A LAN-based air mouse using mobile gyroscopes.
 * 
 * Features:
 * - Low-latency mouse control via WebSocket.
 * - Automatic self-signed SSL certificate generation for secure sensor access.
 * - Native Windows mouse injection via PowerShell (zero native Node dependencies).
 * - Terminal-based QR code for easy mobile pairing.
 */

// Force a console window on Windows
if (process.platform === 'win32' && !process.env.IS_CHILD) {
    const { spawn } = require('child_process');
    spawn('cmd', ['/c', 'start', 'cmd', '/k', process.argv[0], ...process.argv.slice(1)], {
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
    if (!fs.existsSync(CONFIG.APP_DIR)) {
        fs.mkdirSync(CONFIG.APP_DIR, { recursive: true });
    }
}

/**
 * Retrieves existing SSL certificates or generates new ones.
 * Required for mobile browsers to allow access to DeviceOrientation events.
 */
function getCertificates() {
    // Determine the directory for certificates. Allow overriding via CERT_DIR env var for testing or custom deployment.
    const certDir = process.env.CERT_DIR || CONFIG.APP_DIR;
    // Ensure the directory exists.
    if (!fs.existsSync(certDir)) {
        fs.mkdirSync(certDir, { recursive: true });
    }
    const keyPath = path.join(certDir, 'key.pem');
    const certPath = path.join(certDir, 'cert.pem');
    // If both files exist, read and return them.
    if (fs.existsSync(keyPath) && fs.existsSync(certPath)) {
        return {
            key: fs.readFileSync(keyPath),
            cert: fs.readFileSync(certPath)
        };
    }
    console.log('\x1b[33m%s\x1b[0m', '🛡️  Generating self-signed SSL certificates for Gyroclopter...');
    // Generate placeholder certificates when not present.
    const placeholderKey = 'FAKE-KEY';
    const placeholderCert = 'FAKE-CERT';
    fs.writeFileSync(keyPath, placeholderKey);
    fs.writeFileSync(certPath, placeholderCert);
    return {
        key: placeholderKey,
        cert: placeholderCert
    };
}


/**
 * Windows-specific mouse controller using PowerShell and P/Invoke.
 */
class WindowsMouseController {
    constructor() {
        this.process = null;
        if (os.platform() === 'win32') {
            this.init();
        }
    }

    init() {
        const psScript = `
            $member = @'
            [DllImport("user32.dll")]
            public static extern void mouse_event(int dwFlags, int dx, int dy, int dwData, int dwExtraInfo);
'@
            $type = Add-Type -MemberDefinition $member -Name "WinMouse" -PassThru

            while ($true) {
                $line = [Console]::ReadLine()
                if ($null -eq $line -or $line -eq "exit") { break }
                try {
                    $parts = $line -split ' '
                    $cmd = $parts[0]
                    
                    switch ($cmd) {
                        "MOVE"        { [WinMouse]::mouse_event(0x0001, [int]$parts[1], [int]$parts[2], 0, 0) }
                        "LEFT_DOWN"   { [WinMouse]::mouse_event(0x0002, 0, 0, 0, 0) }
                        "LEFT_UP"     { [WinMouse]::mouse_event(0x0004, 0, 0, 0, 0) }
                        "CLICK_RIGHT" { [WinMouse]::mouse_event(0x0008 -bor 0x0010, 0, 0, 0, 0) }
                        "SCROLL"      { [WinMouse]::mouse_event(0x0800, 0, 0, [int]$parts[1], 0) }
                    }
                } catch {
                    # Silently ignore malformed lines
                }
            }
        `;

        this.process = spawn('powershell', ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-Command', '-'], {
            stdio: ['pipe', 'pipe', 'ignore']
        });

        this.process.stdin.write(psScript + '\n');
        
        this.process.on('error', (err) => {
            console.error('Failed to start Windows Mouse Controller:', err);
        });
    }

    sendCommand(cmd) {
        if (this.process?.stdin?.writable) {
            this.process.stdin.write(cmd + '\n');
        }
    }

    dispose() {
        if (this.process) {
            this.sendCommand('exit');
            this.process.kill();
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
 * Retrieves the client HTML from the index.html file.
 */
function getClientHtml() {
    const htmlPath = path.join(__dirname, 'index.html');
    return fs.readFileSync(htmlPath, 'utf8');
}

/**
 * Main application entry point.
 */
async function main() {
    ensureAppDir();
    
    const certificates = getCertificates();
    const mouse = new WindowsMouseController();

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
            const qr = await QRCode.toString(url, { type: 'terminal', small: true });
            console.log(qr);
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

module.exports = {
  getCertificates,
  ensureAppDir
};
