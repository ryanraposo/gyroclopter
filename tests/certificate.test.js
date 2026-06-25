const fs = require('fs');
const path = require('path');
const os = require('os');
const { getCertificates, ensureAppDir } = require('../server');

describe('Certificate Management', () => {
  let tempCertDir;

  beforeAll(() => {
    // Create temporary certificate directory
    tempCertDir = path.join(os.tmpdir(), 'gyroclopter-certs-test');
    fs.rmSync(tempCertDir, { recursive: true });
    fs.mkdirSync(tempCertDir);
  });

  afterAll(() => {
    // Cleanup
    if (fs.existsSync(tempCertDir)) fs.rmSync(tempCertDir, { recursive: true });
  });

  test('Generates new certificates when missing', () => {
    process.env.CERT_DIR = tempCertDir;
    const certs = getCertificates();
    
    expect(fs.existsSync(path.join(tempCertDir, 'key.pem'))).toBe(true);
    expect(fs.existsSync(path.join(tempCertDir, 'cert.pem'))).toBe(true);
    expect(certs.key.toString()).toBe('FAKE-KEY');
    expect(certs.cert.toString()).toBe('FAKE-CERT');
  });

  test('Reuses existing certificates', () => {
    fs.writeFileSync(path.join(tempCertDir, 'key.pem'), 'EXISTING-KEY');
    fs.writeFileSync(path.join(tempCertDir, 'cert.pem'), 'EXISTING-CERT');
    
    process.env.CERT_DIR = tempCertDir;
    const certs = getCertificates();
    
    expect(certs.key.toString()).toBe('EXISTING-KEY');
    expect(certs.cert.toString()).toBe('EXISTING-CERT');
  });

  test('Handles certificate rotation', () => {
    fs.writeFileSync(path.join(tempCertDir, 'key.pem'), 'OLD-KEY');
    fs.writeFileSync(path.join(tempCertDir, 'cert.pem'), 'OLD-CERT');
    
    process.env.CERT_DIR = tempCertDir;
    const certs1 = getCertificates();
    expect(certs1.key.toString()).toBe('FAKE-KEY'); // Should overwrite old
    expect(certs1.cert.toString()).toBe('FAKE-CERT');
  });
});
