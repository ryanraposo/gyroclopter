/**
 * Build a single-file executable from server.js using nexe.
 *
 * Embeds client.html as a resource so the binary is self-contained.
 * On Windows, embeds build/icon.ico as the application icon (requires --build).
 *
 * Output: dist/gyroclopter-<version>.exe (Windows)
 *         dist/gyroclopter-<version>      (Linux/macOS)
 */
const fs = require('fs');
const path = require('path');
const { compile } = require('nexe');

const ROOT = path.join(__dirname, '..');
const DIST = path.join(ROOT, 'dist');
const VERSION = require(path.join(ROOT, 'package.json')).version;

const build = process.argv.includes('--build') || process.argv.includes('-b');
const iconPath = path.join(ROOT, 'build', 'icon.ico');
const useIcon = process.platform === 'win32' && fs.existsSync(iconPath);

const outName = process.platform === 'win32'
  ? `gyroclopter-${VERSION}.exe`
  : `gyroclopter-${VERSION}`;

async function main() {
  fs.mkdirSync(DIST, { recursive: true });
  const outPath = path.join(DIST, outName);

  console.log(`Building binary: ${outPath}`);
  if (build) console.log('  --build: compiling Node.js from source');
  if (useIcon) console.log(`  icon: ${iconPath}`);

  const opts = {
    input: path.join(ROOT, 'server.js'),
    output: outPath,
    resources: [path.join(ROOT, 'client.html')],
    build,
    fakeArgv: true,
    silent: false,
  };

  if (useIcon && build) {
    opts.ico = iconPath;
  }

  try {
    await compile(opts);
  } catch (err) {
    console.error('nexe compilation failed:', err.message);
    process.exit(1);
  }

  if (process.platform !== 'win32' && fs.existsSync(outPath)) {
    fs.chmodSync(outPath, 0o755);
  }
  const size = fs.statSync(outPath).size;
  console.log(`✓ Built ${outPath} (${(size / 1024 / 1024).toFixed(1)} MB)`);

  if (useIcon && !build) {
    console.log('  Note: custom icon requires --build flag (compiling from source).');
    console.log('  Run: node scripts/build-binary.js --build');
  }
}

main();
