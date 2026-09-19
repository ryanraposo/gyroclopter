/**
 * Gyroclopter: A LAN-based air mouse using mobile gyroscopes.
 *
 * Server features:
 * - Low-latency mouse control via WebSocket.
 * - Automatic self-signed SSL certificate generation for secure sensor access.
 * - Native Windows mouse injection via PowerShell (zero native Node dependencies).
 * - JSON stdout protocol for parent process integration.
 */

// Force a console window on Windows when run directly (not as a child process).
// We write a tiny .bat launcher to a known path and `start` it with an explicit
// empty window title. Passing the bat path as the second quoted arg of `start`
// (not the third) is required: `start "<title>" "<command>"` is the only form
// that survives paths with spaces. The previous form `cmd /c start cmd /k <path>`
// fails with "The batch file cannot be found" because `start` interprets its
// first quoted arg as a title and drops the rest.
// 
// Skip自立起動 if stdout is not a TTY (i.e., being piped by a parent process like Electron).
if (require.main === module && process.platform === 'win32' && !process.env.IS_CHILD && process.stdout.isTTY) {
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
const { createInputController } = require('./input');
const { dispatchInputMessage } = require('./input/commands');

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
 * Log file stream for tailable output on Linux.
 */
let logStream = null;
function initLogFile() {
    const logDir = process.env.CERT_DIR || CONFIG.APP_DIR;
    const logPath = path.join(logDir, 'gyroclopter.log');
    try {
        logStream = fs.createWriteStream(logPath, { flags: 'a' });
        // Also symlink to /tmp for easy access
        const tmpLog = path.join(os.tmpdir(), 'gyroclopter.log');
        try { fs.unlinkSync(tmpLog); } catch (_) {}
        fs.symlinkSync(logPath, tmpLog);
    } catch (err) {
        // Log file initialization failed - continue without file logging
    }
}

function writeLog(message) {
    if (logStream) {
        logStream.write(message + '\n');
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
 * Platform-specific input lives under input/.
 *
 * server.js owns transport and protocol lifecycle only. Backends receive the
 * stable command vocabulary: MOVE, LEFT_DOWN, LEFT_UP, CLICK_RIGHT, SCROLL.
 */

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
 * and forces a flush so the parent process never sees a partial line
 * (stdout is fully buffered when piped on Windows).
 */
function emitStatus(obj) {
    const line = JSON.stringify(obj) + '\n';
    process.stdout.write(line);
    writeLog(line.trim());
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
 * Dispatches a parsed WebSocket message to the active input controller.
 *
 * Kept as a small wrapper so the server remains compatible with the existing
 * transport tests while the validation/translation contract lives in input/.
 */
function handleWsMessage(data, input) {
    return dispatchInputMessage(data, input, CONFIG.MOUSE_SENSITIVITY_MULTIPLIER);
}

/**
 * Main application entry point.
 *
 * Communicates status via JSON lines on stdout for parent process integration.
 *
 * Fatal startup errors (EADDRINUSE, cert generation failure, etc.) are reported
 * via a `{"event":"error", ...}` JSON line so the parent can surface them in the
 * UI rather than seeing an unexplained child-process exit.
 */
async function main() {
    try {
        initLogFile();
        ensureAppDir();
        const certificates = await getCertificates();
        const mouse = createInputController();

        let connectedCount = 0;

        const server = https.createServer(certificates, (req, res) => {
            // Serve favicon.png for browser tab icon
            if (req.url === '/favicon.png') {
                const faviconPath = path.join(__dirname, 'app', 'favicon.png');
                try {
                    const faviconData = fs.readFileSync(faviconPath);
                    res.writeHead(200, { 'Content-Type': 'image/png' });
                    res.end(faviconData);
                    return;
                } catch (err) {
                    // Fallback: serve empty 204 if favicon not found
                    res.writeHead(204);
                    res.end();
                    return;
                }
            }
            res.writeHead(200, { 'Content-Type': 'text/html' });
            res.end(getClientHtml());
        });

        const wss = new WebSocket.Server({ server });

        // EADDRINUSE etc. must be caught here, otherwise Node throws
        // "Unhandled 'error' event" and the process exits without telling the
        // parent process what happened.
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

        const localIp = process.env.GYROCLOPTER_PUBLIC_HOST || getLocalIp();
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
                qr: qr,
                inputBackend: mouse.name || 'unknown',
                inputAvailable: mouse.available !== false
            });
        });

        const shutdown = () => {
            const msg = 'Shutting down server...';
            console.log(msg);
            writeLog(msg);
            wss.close(() => {
                const msg2 = 'WebSocket server closed';
                console.log(msg2);
                writeLog(msg2);
            });
            server.close(() => {
                const msg3 = 'HTTP server closed';
                console.log(msg3);
                writeLog(msg3);
                mouse.dispose();
                process.exit(0);
            });
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
// Note: when packaged in asar, require.main === module may not work correctly,
// so we also check if the script path matches
const isMain = require.main === module || 
  (process.argv[1] && process.argv[1].includes('server.js'));

if (isMain) {
  main();
}

module.exports = {
  getCertificates,
  ensureAppDir,
  getLocalIp,
  handleWsMessage,
  CONFIG
};