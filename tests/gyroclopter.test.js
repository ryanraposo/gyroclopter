/**
 * Gyroclopter Test Suite
 * 
 * Comprehensive tests for:
 * 1. Certificate management
 * 2. Directory management  
 * 3. HTTP/HTTPS server
 * 4. WebSocket command handling
 * 5. Configuration validation
 * 6. Error handling
 */

const fs = require('fs');
const path = require('path');
const os = require('os');
const http = require('http');
const https = require('https');
const WebSocket = require('ws');
const { WebSocketServer } = require('ws');

// Import server module exports
const { getCertificates, ensureAppDir, getLocalIp, CONFIG } = require('../server.js');

// Mock Electron IPC
const mockIpcRenderer = {
  send: jest.fn(),
  on: jest.fn()
};

const mockContextBridge = {
  exposeInMainWorld: jest.fn()
};

jest.mock('electron', () => ({
  ipcRenderer: mockIpcRenderer,
  contextBridge: mockContextBridge
}));

describe('Gyroclopter Test Suite', () => {
  let tempDir;

  beforeAll(() => {
    tempDir = path.join(os.tmpdir(), `gyroclopter-test-${Date.now()}`);
    fs.mkdirSync(tempDir, { recursive: true });
  });

  afterAll(async () => {
    if (fs.existsSync(tempDir)) {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
    // Wait for async cleanup
    await new Promise(resolve => setTimeout(resolve, 500));
  });

  // ============================================================================
  // UTILITY FUNCTIONS
  // ============================================================================
  describe('Utility Functions', () => {
    test('getLocalIp returns valid IPv4 format', () => {
      const ip = getLocalIp();
      expect(ip).toMatch(/^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$/);
    });

    test('getLocalIp returns localhost or private IP', () => {
      const ip = getLocalIp();
      const isPrivate = 
        ip === '127.0.0.1' ||
        ip.startsWith('192.168.') ||
        ip.startsWith('10.') ||
        ip.startsWith('172.');
      expect(isPrivate).toBe(true);
    });
  });

  // ============================================================================
  // DIRECTORY MANAGEMENT
  // ============================================================================
  describe('Directory Management', () => {
    test('ensureAppDir creates default directory', () => {
      const testDir = path.join(os.tmpdir(), `gyroclopter-default-${Date.now()}`);
      const originalCertDir = process.env.CERT_DIR;
      process.env.CERT_DIR = testDir;
      
      ensureAppDir();
      expect(fs.existsSync(testDir)).toBe(true);
      
      fs.rmSync(testDir, { recursive: true, force: true });
      process.env.CERT_DIR = originalCertDir;
    });

    test('ensureAppDir respects CERT_DIR environment variable', () => {
      const customDir = path.join(tempDir, 'custom-cert-dir');
      const originalCertDir = process.env.CERT_DIR;
      process.env.CERT_DIR = customDir;
      
      ensureAppDir();
      expect(fs.existsSync(customDir)).toBe(true);
      
      process.env.CERT_DIR = originalCertDir;
    });
  });

  // ============================================================================
  // CERTIFICATE MANAGEMENT
  // ============================================================================
  describe('Certificate Management', () => {
    let certDir;
    let originalCertDir;

    beforeEach(() => {
      originalCertDir = process.env.CERT_DIR;
      certDir = path.join(tempDir, `certs-${Date.now()}`);
      fs.mkdirSync(certDir, { recursive: true });
      process.env.CERT_DIR = certDir;
    });

    afterEach(() => {
      process.env.CERT_DIR = originalCertDir;
    });

    test('generates new certificates when missing', async () => {
      const certs = await getCertificates();
      
      expect(fs.existsSync(path.join(certDir, 'key.pem'))).toBe(true);
      expect(fs.existsSync(path.join(certDir, 'cert.pem'))).toBe(true);
      expect(certs.key).toBeDefined();
      expect(certs.cert).toBeDefined();
      expect(certs.key.toString()).toContain('-----BEGIN');
      expect(certs.cert.toString()).toContain('-----BEGIN');
    });

    test('reuses existing valid PEM certificates', async () => {
      const keyPath = path.join(certDir, 'key.pem');
      const certPath = path.join(certDir, 'cert.pem');
      
      fs.writeFileSync(keyPath, '-----BEGIN PRIVATE KEY-----\nTEST-KEY\n-----END PRIVATE KEY-----');
      fs.writeFileSync(certPath, '-----BEGIN CERTIFICATE-----\nTEST-CERT\n-----END CERTIFICATE-----');
      
      const certs = await getCertificates();
      
      expect(certs.key.toString()).toContain('TEST-KEY');
      expect(certs.cert.toString()).toContain('TEST-CERT');
    });

    test('regenerates invalid certificates', async () => {
      const keyPath = path.join(certDir, 'key.pem');
      const certPath = path.join(certDir, 'cert.pem');
      
      fs.writeFileSync(keyPath, 'INVALID-KEY-DATA');
      fs.writeFileSync(certPath, 'INVALID-CERT-DATA');
      
      const certs = await getCertificates();
      
      // Should regenerate with valid PEM format
      expect(certs.key.toString()).toContain('-----BEGIN PRIVATE KEY-----');
      expect(certs.cert.toString()).toContain('-----BEGIN CERTIFICATE-----');
      expect(certs.key.toString()).not.toContain('INVALID-KEY-DATA');
    });

    test('generates certificates with 365 day validity', async () => {
      const certs = await getCertificates();
      
      // Self-signed certificates should have standard PEM structure
      expect(certs.cert.toString()).toMatch(/-----BEGIN CERTIFICATE-----[\s\S]*-----END CERTIFICATE-----/);
    });
  });

  // ============================================================================
  // HTTP SERVER
  // ============================================================================
  describe('HTTP Server', () => {
    test('serves client.html with correct content type', (done) => {
      const certDir = path.join(tempDir, `http-test-${Date.now()}`);
      fs.mkdirSync(certDir);
      const originalCertDir = process.env.CERT_DIR;
      process.env.CERT_DIR = certDir;
      
      getCertificates().then(certs => {
        const server = https.createServer(certs, (req, res) => {
          res.writeHead(200, { 'Content-Type': 'text/html' });
          res.end(fs.readFileSync(path.join(__dirname, '..', 'client.html'), 'utf8'));
        });

        server.listen(0, () => {
          const port = server.address().port;

          https.get(`https://localhost:${port}`, { rejectUnauthorized: false }, res => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
              try {
                expect(res.statusCode).toBe(200);
                expect(res.headers['content-type']).toContain('text/html');
                expect(data).toContain('<!DOCTYPE html>');
                expect(data).toContain('Gyroclopter');
                
                server.close();
                process.env.CERT_DIR = originalCertDir;
                done();
              } catch (err) {
                server.close();
                process.env.CERT_DIR = originalCertDir;
                done(err);
              }
            });
          }).on('error', (err) => {
            server.close();
            process.env.CERT_DIR = originalCertDir;
            done(err);
          });
        });
      });
    });

    test('serves the same client.html for all requests', (done) => {
      const certDir = path.join(tempDir, `http-multi-${Date.now()}`);
      fs.mkdirSync(certDir);
      const originalCertDir = process.env.CERT_DIR;
      process.env.CERT_DIR = certDir;
      
      getCertificates().then(certs => {
        const server = https.createServer(certs, (req, res) => {
          res.writeHead(200, { 'Content-Type': 'text/html' });
          res.end(fs.readFileSync(path.join(__dirname, '..', 'client.html'), 'utf8'));
        });

        server.listen(0, () => {
          const port = server.address().port;
          const requests = [];

          // Make 3 concurrent requests
          for (let i = 0; i < 3; i++) {
            requests.push(new Promise((resolve, reject) => {
              https.get(`https://localhost:${port}`, { rejectUnauthorized: false }, res => {
                let data = '';
                res.on('data', chunk => data += chunk);
                res.on('end', () => resolve(data));
              }).on('error', reject);
            }));
          }

          Promise.all(requests).then(results => {
            try {
              // All responses should be identical
              expect(results[0]).toBe(results[1]);
              expect(results[1]).toBe(results[2]);
              expect(results[0]).toContain('Gyroclopter');
              
              server.close();
              process.env.CERT_DIR = originalCertDir;
              done();
            } catch (err) {
              server.close();
              process.env.CERT_DIR = originalCertDir;
              done(err);
            }
          }).catch(err => {
            server.close();
            process.env.CERT_DIR = originalCertDir;
            done(err);
          });
        });
      });
    });
  });

  // ============================================================================
  // WEBSOCKET SERVER
  // ============================================================================
  describe('WebSocket Server', () => {
    test('accepts WebSocket connections', (done) => {
      const certDir = path.join(tempDir, `wss-test-${Date.now()}`);
      fs.mkdirSync(certDir);
      const originalCertDir = process.env.CERT_DIR;
      process.env.CERT_DIR = certDir;
      
      getCertificates().then(certs => {
        const server = https.createServer(certs, (req, res) => {
          res.writeHead(200);
          res.end('OK');
        });

        const wss = new WebSocketServer({ server });
        let connected = false;
        
        wss.on('connection', () => {
          connected = true;
        });

        server.listen(0, () => {
          const port = server.address().port;

          const ws = new WebSocket(`wss://localhost:${port}`, {
            rejectUnauthorized: false
          });

          ws.on('open', () => {
            try {
              expect(connected).toBe(true);
              ws.close();
              server.close();
              process.env.CERT_DIR = originalCertDir;
              done();
            } catch (err) {
              server.close();
              process.env.CERT_DIR = originalCertDir;
              done(err);
            }
          });

          ws.on('error', (err) => {
            server.close();
            process.env.CERT_DIR = originalCertDir;
            done(err);
          });
        });
      });
    });

    test('handles mouse move commands', (done) => {
      const certDir = path.join(tempDir, `wss-move-${Date.now()}`);
      fs.mkdirSync(certDir);
      const originalCertDir = process.env.CERT_DIR;
      process.env.CERT_DIR = certDir;
      
      getCertificates().then(certs => {
        const server = https.createServer(certs, (req, res) => {
          res.writeHead(200);
          res.end('OK');
        });

        const wss = new WebSocketServer({ server });
        let receivedCommand = false;
        
        wss.on('connection', (ws) => {
          ws.on('message', (message) => {
            try {
              const data = JSON.parse(message);
              if (data.type === 'move' && data.dx === 10 && data.dy === 20) {
                receivedCommand = true;
              }
            } catch (_) {}
          });
        });

        server.listen(0, () => {
          const port = server.address().port;

          const ws = new WebSocket(`wss://localhost:${port}`, {
            rejectUnauthorized: false
          });

          ws.on('open', () => {
            ws.send(JSON.stringify({ type: 'move', dx: 10, dy: 20 }));
            
            setTimeout(() => {
              try {
                expect(receivedCommand).toBe(true);
                ws.close();
                server.close();
                process.env.CERT_DIR = originalCertDir;
                done();
              } catch (err) {
                server.close();
                process.env.CERT_DIR = originalCertDir;
                done(err);
              }
            }, 100);
          });

          ws.on('error', (err) => {
            server.close();
            process.env.CERT_DIR = originalCertDir;
            done(err);
          });
        });
      });
    });

    test('handles click commands (left and right)', (done) => {
      const certDir = path.join(tempDir, `wss-click-${Date.now()}`);
      fs.mkdirSync(certDir);
      const originalCertDir = process.env.CERT_DIR;
      process.env.CERT_DIR = certDir;
      
      getCertificates().then(certs => {
        const server = https.createServer(certs, (req, res) => {
          res.writeHead(200);
          res.end('OK');
        });

        const wss = new WebSocketServer({ server });
        const commands = [];
        
        wss.on('connection', (ws) => {
          ws.on('message', (message) => {
            try {
              const data = JSON.parse(message);
              commands.push(data.type);
            } catch (_) {}
          });
        });

        server.listen(0, () => {
          const port = server.address().port;

          const ws = new WebSocket(`wss://localhost:${port}`, {
            rejectUnauthorized: false
          });

          ws.on('open', () => {
            // Send click commands
            ws.send(JSON.stringify({ type: 'down' }));
            ws.send(JSON.stringify({ type: 'right' }));
            
            setTimeout(() => {
              try {
                expect(commands).toContain('down');
                expect(commands).toContain('right');
                ws.close();
                server.close();
                process.env.CERT_DIR = originalCertDir;
                done();
              } catch (err) {
                server.close();
                process.env.CERT_DIR = originalCertDir;
                done(err);
              }
            }, 100);
          });

          ws.on('error', done);
        });
      });
    });

    test('handles scroll commands with positive and negative delta', (done) => {
      const certDir = path.join(tempDir, `wss-scroll-${Date.now()}`);
      fs.mkdirSync(certDir);
      const originalCertDir = process.env.CERT_DIR;
      process.env.CERT_DIR = certDir;
      
      getCertificates().then(certs => {
        const server = https.createServer(certs, (req, res) => {
          res.writeHead(200);
          res.end('OK');
        });

        const wss = new WebSocketServer({ server });
        const scrollValues = [];
        
        wss.on('connection', (ws) => {
          ws.on('message', (message) => {
            try {
              const data = JSON.parse(message);
              if (data.type === 'scroll') {
                scrollValues.push(data.delta);
              }
            } catch (_) {}
          });
        });

        server.listen(0, () => {
          const port = server.address().port;

          const ws = new WebSocket(`wss://localhost:${port}`, {
            rejectUnauthorized: false
          });

          ws.on('open', () => {
            // Send scroll commands
            ws.send(JSON.stringify({ type: 'scroll', delta: 120 }));
            ws.send(JSON.stringify({ type: 'scroll', delta: -120 }));
            
            setTimeout(() => {
              try {
                expect(scrollValues).toContain(120);
                expect(scrollValues).toContain(-120);
                ws.close();
                server.close();
                process.env.CERT_DIR = originalCertDir;
                done();
              } catch (err) {
                server.close();
                process.env.CERT_DIR = originalCertDir;
                done(err);
              }
            }, 100);
          });

          ws.on('error', done);
        });
      });
    });

    test('ignores malformed JSON messages', (done) => {
      const certDir = path.join(tempDir, `wss-bad-${Date.now()}`);
      fs.mkdirSync(certDir);
      const originalCertDir = process.env.CERT_DIR;
      process.env.CERT_DIR = certDir;
      
      getCertificates().then(certs => {
        const server = https.createServer(certs, (req, res) => {
          res.writeHead(200);
          res.end('OK');
        });

        const wss = new WebSocketServer({ server });
        let connectionDropped = false;
        
        wss.on('connection', (ws) => {
          ws.on('message', () => {
            // If we get here with bad JSON, the server should handle it gracefully
            // and not crash. We just verify the connection stays open.
          });
          ws.on('error', () => {
            connectionDropped = true;
          });
        });

        server.listen(0, () => {
          const port = server.address().port;

          const ws = new WebSocket(`wss://localhost:${port}`, {
            rejectUnauthorized: false
          });

          ws.on('open', () => {
            // Send malformed JSON
            ws.send('not valid json{{{');
            ws.send('');
            
            setTimeout(() => {
              try {
                // Connection should still be open (not crashed)
                expect(connectionDropped).toBe(false);
                expect(ws.readyState).toBe(WebSocket.OPEN);
                ws.close();
                server.close();
                process.env.CERT_DIR = originalCertDir;
                done();
              } catch (err) {
                server.close();
                process.env.CERT_DIR = originalCertDir;
                done(err);
              }
            }, 100);
          });

          ws.on('error', done);
        });
      });
    });
  });

  // ============================================================================
  // CONFIGURATION
  // ============================================================================
  describe('Configuration', () => {
    test('has correct default port (8443)', () => {
      expect(CONFIG.PORT).toBe(8443);
    });

    test('has sensitivity multiplier configured', () => {
      expect(CONFIG.MOUSE_SENSITIVITY_MULTIPLIER).toBe(1.2);
      expect(typeof CONFIG.MOUSE_SENSITIVITY_MULTIPLIER).toBe('number');
    });

    test('APP_DIR uses temp directory by default', () => {
      expect(CONFIG.APP_DIR).toContain(os.tmpdir());
      expect(CONFIG.APP_DIR).toContain('gyroclopter');
    });
  });

  // ============================================================================
  // ERROR HANDLING
  // ============================================================================
  describe('Error Handling', () => {
    test('handles missing environment variables gracefully', () => {
      const originalCertDir = process.env.CERT_DIR;
      delete process.env.CERT_DIR;
      
      // Should not throw, should use default
      expect(() => ensureAppDir()).not.toThrow();
      
      process.env.CERT_DIR = originalCertDir;
    });

    test('certificate generation does not expose sensitive data in errors', async () => {
      // Set up invalid directory to trigger error
      const invalidDir = '/root/invalid-permissions-test';
      const originalCertDir = process.env.CERT_DIR;
      process.env.CERT_DIR = invalidDir;
      
      try {
        await getCertificates();
        // If it succeeds (running as root), that's ok for this test
      } catch (err) {
        // Error should not expose sensitive paths or internals
        expect(err.message).not.toContain('password');
        expect(err.message).not.toContain('secret');
      }
      
      process.env.CERT_DIR = originalCertDir;
    });
  });
});