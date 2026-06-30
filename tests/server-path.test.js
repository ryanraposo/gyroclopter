/**
 * Test server path resolution logic extracted from electron-main.js
 */
const path = require('path');
const os = require('os');

// Simulate getServerPath logic
function getServerPath(__dirname, resourcesPath) {
  const platform = os.platform();
  const ext = platform === 'win32' ? '.exe' : '';
  const serverName = 'gyroclopter-server' + ext;
  
  if (resourcesPath) {
    return path.join(resourcesPath, 'app.asar', 'server.js');
  }
  
  return path.join(__dirname, '..', 'server.js');
}

describe('Server Path Resolution', () => {
  test('uses relative path in development mode', () => {
    const __dirname = '/home/ryan/repo/gyroclopter/app';
    const serverPath = getServerPath(__dirname, null);
    
    expect(serverPath).toBe('/home/ryan/repo/gyroclopter/server.js');
  });

  test('uses resourcesPath in production mode', () => {
    const __dirname = '/opt/gyroclopter/resources/app.asar/app';
    const resourcesPath = '/opt/gyroclopter/resources';
    const serverPath = getServerPath(__dirname, resourcesPath);
    
    expect(serverPath).toBe('/opt/gyroclopter/resources/app.asar/server.js');
  });

  test('handles Windows paths correctly', () => {
    // Mock Windows platform
    const originalPlatform = process.platform;
    Object.defineProperty(process, 'platform', { value: 'win32' });
    
    const __dirname = 'C:\\Program Files\\gyroclopter\\resources\\app.asar\\app';
    const resourcesPath = 'C:\\Program Files\\gyroclopter\\resources';
    const serverPath = getServerPath(__dirname, resourcesPath);
    
    expect(serverPath).toContain('server.js');
    
    // Restore
    Object.defineProperty(process, 'platform', { value: originalPlatform });
  });
});