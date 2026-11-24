const { spawn } = require('child_process');
const { once } = require('events');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { createInterface } = require('readline');
const WebSocket = require('ws');

function requestConnection(url) {
  return new Promise((resolve, reject) => {
    const socket = new WebSocket(url, { rejectUnauthorized: false, handshakeTimeout: 3000 });
    socket.once('error', reject);
    socket.once('open', () => {
      socket.close();
      resolve(101);
    });
    socket.once('unexpected-response', (_request, response) => {
      response.resume();
      resolve(response.statusCode);
    });
  });
}

test('Store sessions only accept the current pairing link and omit it from logs', async () => {
  const certDir = fs.mkdtempSync(path.join(os.tmpdir(), 'gyroclopter-store-pairing-'));
  const child = spawn(process.execPath, [path.join(__dirname, '..', 'server.js')], {
    env: {
      ...process.env,
      CERT_DIR: certDir,
      ELECTRON_RUN_AS_NODE: '1',
      GYROCLOPTER_INPUT_BACKEND: 'none',
      GYROCLOPTER_PAIRING_REQUIRED: '1',
      PORT: '0'
    },
    stdio: ['pipe', 'pipe', 'ignore']
  });
  const closed = once(child, 'close');
  const lines = createInterface({ input: child.stdout });
  try {
    const started = await new Promise((resolve, reject) => {
      lines.on('line', (line) => {
        const status = JSON.parse(line);
        if (status.event === 'started') resolve(status);
        if (status.event === 'error') reject(new Error(status.message));
      });
      lines.once('close', () => reject(new Error('Server closed before reporting its pairing address')));
    });

    const origin = `wss://127.0.0.1:${started.port}`;
    const key = new URL(started.pairingUrl).hash.slice('#pair='.length);
    expect(key).toMatch(/^[a-f0-9]{32}$/);
    await expect(requestConnection(origin)).resolves.toBe(401);
    await expect(requestConnection(`${origin}/pair/${'0'.repeat(32)}`)).resolves.toBe(401);
    await expect(requestConnection(`${origin}/pair/${key}`)).resolves.toBe(101);

    child.stdin.end();
    await expect(closed).resolves.toEqual([0, null]);
    const log = fs.readFileSync(path.join(certDir, 'gyroclopter.log'), 'utf8');
    expect(log).toContain('"event":"started"');
    expect(log).not.toContain(key);
    expect(log).not.toContain('data:image');
  } finally {
    if (!child.stdin.writableEnded) child.stdin.end();
    await closed;
    fs.rmSync(certDir, { recursive: true, force: true });
  }
}, 12000);
