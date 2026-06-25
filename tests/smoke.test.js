const fs = require('fs');
const path = require('path');
const os = require('os');
const http = require('http');
const { createServer } = require('https');
const { WebSocketServer } = require('ws');
const selfsigned = require('selfsigned');
const { getCertificates, ensureAppDir } = require('../server');

describe('Gyroclopter Smoke Tests', () => {
  let server;
  let wss;
  let tempCertDir;

  beforeAll(async () => {
    // Create temporary certificate directory
    tempCertDir = path.join(os.tmpdir(), 'gyroclopter-smoke-test');
    fs.rmSync(tempCertDir, { recursive: true });
    fs.mkdirSync(tempCertDir);
    
    process.env.CERT_DIR = tempCertDir;
    await ensureAppDir();
  });

  afterAll(() => {
    // Cleanup
    if (fs.existsSync(tempCertDir)) fs.rmSync(tempCertDir, { recursive: true });
    delete process.env.CERT_DIR;
  });

  test('Server starts and serves client HTML', async () => {
    const server = createServer((req, res) => {
      res.writeHead(200, { 'Content-Type': 'text/html' });
      res.end(fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8'));
    });

    await new Promise(resolve => server.listen(0, () => resolve()));
    
    const response = await new Promise((resolve, reject) => {
      http.get(`http://localhost:${server.address().port}`, res => {
        let data = '';
        res.on('data', chunk => data += chunk);
        res.on('end', () => {
          expect(data).toContain('<!DOCTYPE html>');
          expect(data).toContain('<script>');
          resolve();
        });
      }).on('error', reject);
    });

    server.close();
  });

  test('WebSocket connection handles mouse commands', async () => {
    const cert = await getCertificates();
    const server = createServer(cert, (req, res) => {
      res.writeHead(200, { 'Content-Type': 'text/html' });
      res.end(fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8'));
    });

    wss = new WebSocketServer({ server });
    
    await new Promise(resolve => server.listen(0, () => resolve()));
    
    const ws = new WebSocket(`wss://localhost:${server.address().port}`);
    
    // Test move command
    ws.send(JSON.stringify({
      type: 'move',
      dx: 10,
      dy: 20
    }));
    
    // Test click command
    ws.send(JSON.stringify({ type: 'right' }));
    
    await new Promise(resolve => setTimeout(resolve, 500));
    
    server.close();
  });
});
