/**
 * Build a single-file executable from server.js using @yao-pkg/pkg.
 *
 * Static options (assets) live in pkg.config.cjs because the CLI has no --assets.
 * Per-platform target and output name are set here.
 *
 * Output: dist/gyroclopter-<version>.(exe|<nothing on Linux>)
 *
 * The Windows icon is embedded afterward by build:win via rcedit.
 * The Linux binary is later wrapped by build:linux into a .deb package.
 */
const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const ROOT = path.join(__dirname, '..');
const DIST = path.join(ROOT, 'dist');
const VERSION = require(path.join(ROOT, 'package.json')).version;

function target() {
  if (process.platform === 'win32') {
    return { node: 'node24-win-x64', out: `gyroclopter-${VERSION}.exe` };
  }
  if (process.platform === 'linux') {
    return { node: 'node24-linux-x64', out: `gyroclopter-${VERSION}` };
  }
  throw new Error(`Unsupported platform: ${process.platform}`);
}

function main() {
  fs.mkdirSync(DIST, { recursive: true });
  const t = target();
  const outPath = path.join(DIST, t.out);
  const pkg = path.join(ROOT, 'node_modules', '.bin',
    process.platform === 'win32' ? 'pkg.cmd' : 'pkg');

  console.log(`Building binary: ${outPath}`);
  const r = spawnSync(`"${pkg}"`, [
    '--targets', t.node,
    '--output', outPath,
    '--config', 'pkg.config.cjs',
    'server.js'
  ], { stdio: 'inherit', shell: true });

  if (r.status !== 0) {
    console.error(`pkg exited with code ${r.status}`);
    process.exit(r.status ?? 1);
  }
  if (process.platform !== 'win32' && fs.existsSync(outPath)) {
    fs.chmodSync(outPath, 0o755);
  }
  const size = fs.statSync(outPath).size;
  console.log(`✓ Built ${outPath} (${(size / 1024 / 1024).toFixed(1)} MB)`);
}

main();