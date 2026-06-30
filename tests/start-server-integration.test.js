/**
 * Integration test: Start Server → Server spawn → HTTPS response
 */
const { spawn } = require('child_process');
const path = require('path');
const https = require('https');
const fs = require('fs');
const os = require('os');

describe('Start Server Integration', () => {
  let testCertDir;
  const originalExecArgv = process.execArgv;

  beforeAll(() => {
    testCertDir = path.join(os.tmpdir(), 'gyroclopter-integration-test-' + Date.now());
    fs.mkdirSync(testCertDir, { recursive: true });
    // Increase test timeout for server startup
    jest.setTimeout(15000);
  });

  afterAll(() => {
    if (fs.existsSync(testCertDir)) {
      try {
        fs.rmSync(testCertDir, { recursive: true, force: true });
      } catch (_) {}
    }
  });

  test('server.js can be spawned via node and responds on HTTPS', (done) => {
    const serverPath = path.join(__dirname, '..', 'server.js');
    
    // Spawn server with a test port via CERT_DIR
    const env = { ...process.env, CERT_DIR: testCertDir };
    const serverProcess = spawn(process.execPath, [serverPath], {
      env,
      stdio: ['ignore', 'pipe', 'pipe']
    });

    let serverStarted = false;
    let cleanupDone = false;

    const cleanup = (err) => {
      if (cleanupDone) return;
      cleanupDone = true;
      
      try {
        serverProcess.kill();
      } catch (_) {}
      
      if (err) done(err);
      else done();
    };

    serverProcess.stdout.on('data', (data) => {
      const lines = data.toString().split('\n').filter(Boolean);
      for (const line of lines) {
        try {
          const msg = JSON.parse(line);
          if (msg.event === 'started') {
            serverStarted = true;
            const url = `https://${msg.ip}:${msg.port}`;
            
            // Make HTTPS request to verify server responds
            https.get(url, { rejectUnauthorized: false }, (res) => {
              let body = '';
              res.on('data', chunk => body += chunk);
              res.on('end', () => {
                try {
                  expect(res.statusCode).toBe(200);
                  expect(body).toContain('Gyroclopter');
                  expect(serverStarted).toBe(true);
                  cleanup();
                } catch (err) {
                  cleanup(err);
                }
              });
            }).on('error', (err) => {
              cleanup(new Error('HTTPS request failed: ' + err.message));
            });
          }
        } catch (_) {}
      }
    });

    serverProcess.stderr.on('data', (data) => {
      const msg = data.toString();
      if (msg.includes('ERROR') || msg.includes('ERR')) {
        console.error('Server stderr:', msg);
      }
    });

    serverProcess.on('error', (err) => {
      cleanup(new Error('Server spawn failed: ' + err.message));
    });

    serverProcess.on('exit', (code) => {
      if (!serverStarted && code !== 0) {
        cleanup(new Error('Server exited with code ' + code));
      }
    });

    // Timeout
    setTimeout(() => {
      if (!serverStarted) {
        cleanup(new Error('Server did not start within timeout'));
      }
    }, 10000);
  });
});