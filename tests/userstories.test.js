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

  test('getCertificates generates placeholder certificates when none exist', () => {
    // Use a fresh temporary directory
    const certDir = path.join(os.tmpdir(), 'gyroclopter-cert-test');
    if (fs.existsSync(certDir)) {
      fs.rmSync(certDir, { recursive: true, force: true });
    }
    process.env.CERT_DIR = certDir;
    const certs = getCertificates();
    const keyPath = path.join(certDir, 'key.pem');
    const certPath = path.join(certDir, 'cert.pem');
    expect(fs.existsSync(keyPath)).toBe(true);
    expect(fs.existsSync(certPath)).toBe(true);
    const keyContent = fs.readFileSync(keyPath, 'utf8');
    const certContent = fs.readFileSync(certPath, 'utf8');
    expect(keyContent).toBe('FAKE-KEY');
    expect(certContent).toBe('FAKE-CERT');
    expect(certs.key.toString()).toBe('FAKE-KEY');
    expect(certs.cert.toString()).toBe('FAKE-CERT');
    // Cleanup
    fs.rmSync(certDir, { recursive: true, force: true });
    delete process.env.CERT_DIR;
  });
});
