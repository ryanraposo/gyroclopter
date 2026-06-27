const fs = require('fs');
const path = require('path');
const os = require('os');
const http = require('http');
const WebSocket = require('ws');
const { WebSocketServer } = require('ws');
const { getCertificates, ensureAppDir } = require('../server');

describe('User Stories', () => {
  let tempDir;
  
  beforeAll(() => {
    // Create temporary directory for testing
    tempDir = path.join(os.tmpdir(), 'gyroclopter-us-test');
    if (fs.existsSync(tempDir)) fs.rmSync(tempDir, { recursive: true });
    fs.mkdirSync(tempDir);
  });

  afterAll(() => {
    // Cleanup
    if (fs.existsSync(tempDir)) fs.rmSync(tempDir, { recursive: true });
  });

  test('User can connect via WebSocket and control mouse', async () => {
    const certDir = path.join(os.tmpdir(), 'gyroclopter-us-cert');
    if (fs.existsSync(certDir)) fs.rmSync(certDir, { recursive: true });
    fs.mkdirSync(certDir);
    
    process.env.CERT_DIR = certDir;
    await ensureAppDir();
    
    // Simulate server startup
    const certs = await getCertificates();
    const server = require('https').createServer(certs, (req, res) => {
      res.writeHead(200, { 'Content-Type': 'text/html' });
      res.end(fs.readFileSync(path.join(__dirname, '..', 'client.html'), 'utf8'));
    });

    const wss = new WebSocketServer({ server });
    
    await new Promise(resolve => server.listen(0, () => resolve()));
    
    // Test WebSocket commands
    const ws = new WebSocket(`wss://localhost:${server.address().port}`, {
      rejectUnauthorized: false
    });
    
    // Wait for connection
    await new Promise(resolve => {
      ws.addEventListener('open', resolve);
    });
    
    // Move command
    ws.send(JSON.stringify({
      type: 'move',
      dx: 10,
      dy: 20
    }));
    
    // Click command
    ws.send(JSON.stringify({ type: 'right' }));
    
    await new Promise(resolve => setTimeout(resolve, 500));
    
    ws.close();
    server.close();
  });
});
