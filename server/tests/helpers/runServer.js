/**
 * Test helper: launches the real server.js as a child process. This is closer
 * to how Neutralino spawns the binary than mocking everything, because it
 * exercises the actual `main()` path: cert generation, HTTPS creation, wss
 * attachment, JSON-line stdout.
 *
 * The server listens on its hard-coded CONFIG.PORT (8443). Tests using this
 * helper must run serially and must not collide with anything else on 8443.
 *
 * Usage:
 *   const child = await startServer({ certDir: '/tmp/x' });
 *   await waitForEvent(child, (m) => m.event === 'started');
 *   // ... drive the server ...
 *   await stopServer(child);
 */
const { spawn } = require('child_process');
const path = require('path');

function startServer({ certDir, extraEnv = {} } = {}) {
  const serverPath = path.join(__dirname, '..', 'server.js');
  const env = {
    ...process.env,
    IS_NEUTRALINO_CHILD: '1',
    IS_CHILD: '1',
    ...(certDir ? { CERT_DIR: certDir } : {}),
    ...extraEnv
  };
  const child = spawn(process.execPath, [serverPath], {
    env,
    stdio: ['ignore', 'pipe', 'pipe']
  });
  return child;
}

/**
 * Reads stdout line-by-line, parses each as JSON, and resolves when a line
 * matches `predicate`. All previously-seen JSON lines are returned in `all`
 * for diagnostics. Non-JSON output is silently ignored (the server is allowed
 * to log via console.error, which is on stderr anyway).
 */
function waitForEvent(child, predicate, { timeoutMs = 8000 } = {}) {
  return new Promise((resolve, reject) => {
    const lines = [];
    let buf = '';
    const timer = setTimeout(() => {
      reject(new Error(`Timed out after ${timeoutMs}ms; saw: ${JSON.stringify(lines)}`));
    }, timeoutMs);

    const onChunk = (chunk) => {
      buf += chunk.toString();
      let idx;
      while ((idx = buf.indexOf('\n')) !== -1) {
        const line = buf.slice(0, idx).trim();
        buf = buf.slice(idx + 1);
        if (!line) continue;
        try {
          const obj = JSON.parse(line);
          lines.push(obj);
          if (predicate(obj)) {
            clearTimeout(timer);
            child.stdout.off('data', onChunk);
            resolve({ match: obj, all: lines });
            return;
          }
        } catch (_) {
          // Non-JSON line; ignore (e.g. unrelated logging).
        }
      }
    };
    child.stdout.on('data', onChunk);
  });
}

function stopServer(child) {
  return new Promise((resolve) => {
    if (!child || child.exitCode !== null) return resolve();
    const done = () => resolve();
    child.once('exit', done);
    try {
      child.kill('SIGTERM');
    } catch (_) {
      resolve();
    }
    setTimeout(() => {
      if (child.exitCode === null) {
        try { child.kill('SIGKILL'); } catch (_) {}
      }
    }, 1500);
  });
}

module.exports = { startServer, waitForEvent, stopServer };