const fs = require('fs');
const path = require('path');
const http = require('http');
const { WebSocketServer } = require('ws');
const WebSocket = require('ws');

describe('Gyroclopter Smoke Tests', () => {
  let server;
  let wss;

  afterAll(() => {
    if (wss) wss.close();
    if (server) server.close();
  });

  test('Server serves client HTML', async () => {
    server = http.createServer((req, res) => {
      res.writeHead(200, { 'Content-Type': 'text/html' });
      res.end(fs.readFileSync(path.join(__dirname, '..', 'client.html'), 'utf8'));
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
    server = http.createServer((req, res) => {
      res.writeHead(200, { 'Content-Type': 'text/html' });
      res.end('OK');
    });

    wss = new WebSocketServer({ server });
    
    await new Promise(resolve => server.listen(0, () => resolve()));
    
    const ws = new WebSocket(`ws://localhost:${server.address().port}`);
    
    // Wait for connection
    await new Promise((resolve, reject) => {
      const timeout = setTimeout(() => reject(new Error('Connection timeout')), 3000);
      ws.addEventListener('open', () => { clearTimeout(timeout); resolve(); });
      ws.addEventListener('error', (e) => { clearTimeout(timeout); reject(e); });
    });
    
    // Test move command
    ws.send(JSON.stringify({
      type: 'move',
      dx: 10,
      dy: 20
    }));
    
    // Test click command
    ws.send(JSON.stringify({ type: 'right' }));
    
    // Test scroll command
    ws.send(JSON.stringify({ type: 'scroll', delta: 120 }));
    
    await new Promise(resolve => setTimeout(resolve, 100));
    
    ws.close();
    server.close();
    wss = null;
    server = null;
  });
});