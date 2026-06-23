const fs = require('fs');
const path = require('path');
const os = require('os');
const https = require('https');
const { WebSocketServer } = require('ws');
const selfsigned = require('selfsigned');

const { getCertificates, ensureAppDir } = require('../server');
describe('Gyroclopter server modules', () => {
  // No setup needed; server handles certificate directory creation.

  test('generates a new certificate when files are missing', () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'gyroclopter-verify-'));
    const keyPath = path.join(tmp, 'key.pem');
    const certPath = path.join(tmp, 'cert.pem');

    fs.rmSync(tmp, { recursive: true, force: true });
    expect(fs.existsSync(keyPath)).toBe(false);
    expect(fs.existsSync(certPath)).toBe(false);

    process.env.CERT_DIR = tmp;
    const cert = getCertificates();
    expect(fs.existsSync(keyPath)).toBe(true);
    expect(fs.existsSync(certPath)).toBe(true);
    expect(cert.key.toString()).toBeTruthy();
    expect(cert.cert.toString()).toBeTruthy();
  });

  test('reuses existing certificate files and returns matching buffers', () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'gyroclopter-reuse-'));
    const keyPath = path.join(tmp, 'key.pem');
    const certPath = path.join(tmp, 'cert.pem');
    fs.writeFileSync(keyPath, 'KEY-STUB');
    fs.writeFileSync(certPath, 'CERT-STUB');

    process.env.CERT_DIR = tmp;
    const cert = getCertificates();
    expect(cert.key.toString()).toBe('KEY-STUB');
    expect(cert.cert.toString()).toBe('CERT-STUB');
  });
});
