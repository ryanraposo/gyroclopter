const fs = require('fs');
const path = require('path');
const os = require('os');

// Import utilities from server
const { getCertificates, ensureAppDir } = require('../server');

describe('User Stories', () => {
  const tempDir = path.join(os.tmpdir(), 'gyroclopter-us-test');

  afterAll(() => {
    // Cleanup temp directory if it exists
    try {
      if (fs.existsSync(tempDir)) {
        fs.rmSync(tempDir, { recursive: true, force: true });
      }
    } catch (_) {}
  });

  test('ensureAppDir creates application directory when missing', () => {
    // Ensure the directory does not exist before test
    if (fs.existsSync(tempDir)) {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
    // Temporarily override CONFIG.APP_DIR by setting environment variable
    const originalAppDir = process.env.CERT_DIR;
    process.env.CERT_DIR = tempDir;
    // Ensure clean state
    ensureAppDir();
    expect(fs.existsSync(tempDir)).toBe(true);
    // Restore env
    if (originalAppDir === undefined) delete process.env.CERT_DIR; else process.env.CERT_DIR = originalAppDir;
  });

  function cleanupCertEnv(tmp) {
    delete process.env.CERT_DIR;
    try {
      fs.rmSync(tmp, { recursive: true, force: true });
    } catch (_) {}
  }

  test('getCertificates generates self-signed PEM certificates when none exist', async () => {
    // Use a fresh temporary directory
    const certDir = path.join(os.tmpdir(), 'gyroclopter-cert-test');
    if (fs.existsSync(certDir)) {
      fs.rmSync(certDir, { recursive: true, force: true });
    }
    process.env.CERT_DIR = certDir;
    const certs = await getCertificates();
    const keyPath = path.join(certDir, 'key.pem');
    const certPath = path.join(certDir, 'cert.pem');
    expect(fs.existsSync(keyPath)).toBe(true);
    expect(fs.existsSync(certPath)).toBe(true);
    const keyContent = fs.readFileSync(keyPath, 'utf8');
    const certContent = fs.readFileSync(certPath, 'utf8');
    expect(keyContent).toContain('-----BEGIN PRIVATE KEY-----');
    expect(certContent).toContain('-----BEGIN CERTIFICATE-----');
    expect(certs.key.toString()).toContain('-----BEGIN PRIVATE KEY-----');
    expect(certs.cert.toString()).toContain('-----BEGIN CERTIFICATE-----');
    // Cleanup
    cleanupCertEnv(certDir);
  });
});
