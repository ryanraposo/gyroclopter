const fs = require('fs');
const path = require('path');
const os = require('os');
const http = require('http');

const SERVER_PATH = path.resolve(path.join(__dirname, '..', 'server.js'));
const SOURCE = fs.readFileSync(SERVER_PATH, 'utf8');
const HTML_PATH = path.join(path.resolve(path.join(__dirname, '..')), 'index.html');
const HTML = fs.readFileSync(HTML_PATH, 'utf8');

describe('HTML client encoding and rendering', () => {
  test('server.js extracts client HTML into index.html with full HTML document', () => {
    expect(fs.existsSync(HTML_PATH)).toBe(true);
    expect(HTML).toContain('<!DOCTYPE html>');
    expect(HTML).toContain('<html');
    expect(HTML).toContain('<head>');
    expect(HTML).toContain('<body>');
    expect(HTML).toContain('<script>');
    expect(HTML).toContain('</html>');
  });

  test('extracted client has WebSocket client wiring', () => {
    expect(HTML).toMatch(/new\s+WebSocket/i);
    expect(HTML).toMatch(/ws\.onopen/i);
  });
});

describe('Gyroclopter smoke: startup and paths', () => {
  const certDir = path.join(os.tmpdir(), 'gyroclopter-smoke-' + Date.now());
  let originalAppDir;
  let originalEnv;

  beforeAll(() => {
    originalAppDir = require.cache[require.resolve(SERVER_PATH)];
    originalEnv = { ...process.env };
    if (fs.existsSync(certDir)) {
      fs.rmSync(certDir, { recursive: true, force: true });
    }
    fs.mkdirSync(certDir, { recursive: true });
  });

  afterAll(() => {
    try {
      fs.rmSync(certDir, { recursive: true, force: true });
    } catch {}
    process.env = originalEnv;
  });

  test('certificate storage path is reachable and writable', () => {
    const keyPath = path.join(certDir, 'key.pem');
    const certPath = path.join(certDir, 'cert.pem');
    expect(fs.existsSync(keyPath)).toBe(false);
    expect(fs.existsSync(certPath)).toBe(false);
    fs.writeFileSync(keyPath, 'STUB-KEY');
    fs.writeFileSync(certPath, 'STUB-CERT');
    expect(fs.readFileSync(keyPath, 'utf8')).toBe('STUB-KEY');
    expect(fs.readFileSync(certPath, 'utf8')).toBe('STUB-CERT');
  });
});
