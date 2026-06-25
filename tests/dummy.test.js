const fs = require('fs');
const path = require('path');
const os = require('os');
const { getLocalIp, ensureAppDir, CONFIG } = require('../server');

describe('Utility Functions', () => {
  test('getLocalIp returns a valid IPv4 address for LAN access', () => {
    const ip = getLocalIp();
    // Should be a valid IPv4 address (localhost or private IP)
    expect(ip).toMatch(/^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$/);
    expect(['127.0.0.1', 'localhost'].includes(ip) || ip.startsWith('192.168.') || ip.startsWith('10.') || ip.startsWith('172.')).toBe(true);
  });

  test('ensureAppDir creates directory when missing and respects CERT_DIR env var', () => {
    const tempDir = path.join(os.tmpdir(), 'gyroclopter-dummy-test');
    if (fs.existsSync(tempDir)) fs.rmSync(tempDir, { recursive: true });
    
    // Test default behavior
    ensureAppDir();
    const appDir = process.env.CERT_DIR || path.join(os.tmpdir(), 'gyroclopter');
    expect(fs.existsSync(appDir)).toBe(true);
    
    // Test with CERT_DIR override
    process.env.CERT_DIR = tempDir;
    ensureAppDir();
    expect(fs.existsSync(tempDir)).toBe(true);
    
    // Cleanup
    fs.rmSync(tempDir, { recursive: true });
  });
});
