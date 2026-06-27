const fs = require('fs');
const path = require('path');
const os = require('os');
const { getCertificates, ensureAppDir } = require('../server');

describe('Certificate Management', () => {
  let tempCertDir;

  beforeAll(() => {
    // Create temporary certificate directory
    tempCertDir = path.join(os.tmpdir(), 'gyroclopter-certs-test');
    if (fs.existsSync(tempCertDir)) fs.rmSync(tempCertDir, { recursive: true });
    fs.mkdirSync(tempCertDir);
  });

  afterAll(() => {
    // Cleanup
    if (fs.existsSync(tempCertDir)) fs.rmSync(tempCertDir, { recursive: true });
  });

  test('Generates new certificates when missing', async () => {
    process.env.CERT_DIR = tempCertDir;
    const certs = await getCertificates();
    
    expect(fs.existsSync(path.join(tempCertDir, 'key.pem'))).toBe(true);
    expect(fs.existsSync(path.join(tempCertDir, 'cert.pem'))).toBe(true);
    // Certificates are generated with selfsigned library
    expect(certs.key).toBeDefined();
    expect(certs.cert).toBeDefined();
  });

  test('Reuses existing valid PEM certificates', async () => {
    fs.writeFileSync(path.join(tempCertDir, 'key.pem'), '-----BEGIN PRIVATE KEY-----\nEXISTING-KEY\n-----END PRIVATE KEY-----');
    fs.writeFileSync(path.join(tempCertDir, 'cert.pem'), '-----BEGIN CERTIFICATE-----\nEXISTING-CERT\n-----END CERTIFICATE-----');
    
    process.env.CERT_DIR = tempCertDir;
    const certs = await getCertificates();
    
    expect(certs.key.toString()).toContain('EXISTING-KEY');
    expect(certs.cert.toString()).toContain('EXISTING-CERT');
  });

  test('Handles certificate rotation (invalid PEM is regenerated)', async () => {
    fs.writeFileSync(path.join(tempCertDir, 'key.pem'), 'OLD-KEY');
    fs.writeFileSync(path.join(tempCertDir, 'cert.pem'), 'OLD-CERT');
    
    process.env.CERT_DIR = tempCertDir;
    const certs1 = await getCertificates();
    // Invalid PEM certificates are regenerated (not reused)
    expect(certs1.key.toString()).toContain('BEGIN PRIVATE KEY');
    expect(certs1.cert.toString()).toContain('BEGIN CERTIFICATE');
    expect(certs1.key.toString()).not.toContain('OLD-KEY');
    expect(certs1.cert.toString()).not.toContain('OLD-CERT');
  });
});
