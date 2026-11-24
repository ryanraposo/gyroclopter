const { spawnSync } = require('child_process');
const fs = require('fs');
const path = require('path');

if (process.platform !== 'win32') throw new Error('Store packages must be built on Windows.');

const root = path.join(__dirname, '..');
const output = path.join(root, 'build', 'windows-store');
fs.mkdirSync(output, { recursive: true });

const result = spawnSync('cl.exe', [
  '/nologo', '/W4', '/O2', '/MT',
  '/Fe:gyroclopter-mouse.exe', path.join(root, 'native', 'windows-store-mouse.c'),
  '/link', '/MACHINE:X64', 'user32.lib'
], { cwd: output, stdio: 'inherit' });

if (result.error) {
  throw new Error('Run the Store build in an x64 Native Tools Command Prompt for Visual Studio.', {
    cause: result.error
  });
}
process.exitCode = result.status ?? 1;
