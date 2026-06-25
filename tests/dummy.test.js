const fs = require('fs');
const path = require('path');
const os = require('os');
const { getLocalIp, ensureAppDir } = require('../server');

describe('Utility Functions', () => {
  test('getLocalIp returns a valid IPv4 address for LAN access', () => {
    const ip = getLocalIp();
    expect(ip).toBeOneOf(['127.0.0.1', '192.168.x.x', '10.x.x.x']);
  });

  test('ensureAppDir creates directory when missing and respects CERT_DIR env var', () => {
    const tempDir = path.join(os.tmpdir(), 'gyroclopter-dummy-test');
    if (fs.existsSync(tempDir)) fs.rmSync(tempDir, { recursive: true });
    
    // Test default behavior
    ensureAppDir();
    expect(fs.existsSync(CONFIG.APP_DIR)).toBe(true);
    
    // Test with CERT_DIR override
    process.env.CERT_DIR = tempDir;
    ensureAppDir();
    expect(fs.existsSync(tempDir)).toBe(true);
    
    // Cleanup
    fs.rmSync(tempDir, { recursive: true });
  });
});
