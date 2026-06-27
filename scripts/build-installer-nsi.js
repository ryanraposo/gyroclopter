/**
 * Compile installer.nsi with makensis to produce dist/gyroclopter-setup-<version>.exe.
 */
const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const ROOT = path.join(__dirname, '..');
const VERSION = require(path.join(ROOT, 'package.json')).version;

function findMakensis() {
  const candidates = [
    'C:\\Program Files (x86)\\NSIS\\makensis.exe',
    'C:\\Program Files\\NSIS\\makensis.exe',
    'makensis.exe',
    'makensis'
  ];
  for (const c of candidates) {
    if (c.includes('\\')) {
      if (fs.existsSync(c)) return c;
    } else {
      const r = spawnSync('where', [c], { stdio: 'ignore' });
      if (r.status === 0) return c;
    }
  }
  return null;
}

function main() {
  const makensis = findMakensis();
  if (!makensis) {
    console.error('makensis not found. Install NSIS from https://nsis.sourceforge.io/');
    process.exit(1);
  }

  const args = [
    `/DVERSION=${VERSION}`,
    `/DPRODUCT_VERSION=${VERSION}`,
    'installer.nsi'
  ];
  console.log(`> "${makensis}" ${args.join(' ')}`);
  const r = spawnSync(`"${makensis}"`, args, { stdio: 'inherit', shell: true });
  if (r.status !== 0) {
    console.error(`makensis exited with code ${r.status}`);
    process.exit(r.status ?? 1);
  }
  console.log('✓ Installer built');
}

main();