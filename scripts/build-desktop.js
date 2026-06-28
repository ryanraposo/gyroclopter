/**
 * Build the Neutralino desktop app.
 *
 * Prerequisites:
 *   1. npm run build:icons   — generates build/icons/*.png
 *   2. npm run build:server  — generates dist/gyroclopter-server.exe
 *
 * Steps:
 *   1. Copy desktop source files (HTML, JS, CSS) → resources/
 *   2. Copy server binary → resources/ (for embedding)
 *   3. Copy tray icon from build/icons/ → resources/icons/
 *   4. Run `neu build --release --embed-resources`
 *   5. Extract Neutralino ZIP → dist/gyroclopter/
 *   6. Copy full runtime folder → dist/gyroclopter/
 */

const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const ROOT = path.join(__dirname, '..');
const DIST = path.join(ROOT, 'dist');
const RESOURCES = path.join(ROOT, 'resources');
const DESKTOP_SRC = path.join(ROOT, 'desktop', 'src');
const ICONS_DIR = path.join(ROOT, 'build', 'icons');
const VERSION = require(path.join(ROOT, 'package.json')).version;
const BINARY_NAME = 'gyroclopter';

function copy(src, dst) {
  fs.mkdirSync(path.dirname(dst), { recursive: true });
  fs.copyFileSync(src, dst);
  console.log(`  ${src} → ${dst}`);
}

function main() {
  const isDev = process.argv.includes('--dev');

  const serverExe = path.join(DIST, `gyroclopter-${VERSION}.exe`);
  if (!isDev && !fs.existsSync(serverExe)) {
    console.error(`Server binary not found: ${serverExe}`);
    console.error('Run "npm run build:server" first.');
    process.exit(1);
  }

  if (!fs.existsSync(ICONS_DIR)) {
    console.error(`Icons directory not found: ${ICONS_DIR}`);
    console.error('Run "npm run build:icons" first.');
    process.exit(1);
  }

  console.log(isDev ? 'Preparing Neutralino dev resources...' : 'Building Neutralino desktop app...');

  // ------------------------------------------------------------
  // 0. Ensure resources directory exists
  // ------------------------------------------------------------
  fs.mkdirSync(RESOURCES, { recursive: true });

  // ------------------------------------------------------------
  // 0a. Ensure .well-known/appspecific exists BEFORE copying anything
  // ------------------------------------------------------------
  const devtoolsDir = path.join(RESOURCES, '.well-known', 'appspecific');
  fs.mkdirSync(devtoolsDir, { recursive: true });

  // ------------------------------------------------------------
  // 0b. Copy devtools manifest if inspector is enabled
  // ------------------------------------------------------------
  const devtoolsSrc = path.join(
    ROOT,
    'desktop',
    'resources',
    '.well-known',
    'appspecific',
    'com.chrome.devtools.json'
  );
  const devtoolsDst = path.join(devtoolsDir, 'com.chrome.devtools.json');

  if (fs.existsSync(devtoolsSrc)) {
    copy(devtoolsSrc, devtoolsDst);
  }

  // ------------------------------------------------------------
  // 1. Copy desktop source files
  // ------------------------------------------------------------
  copy(path.join(DESKTOP_SRC, 'index.html'), path.join(RESOURCES, 'index.html'));
  copy(path.join(DESKTOP_SRC, 'main.js'), path.join(RESOURCES, 'main.js'));
  copy(path.join(DESKTOP_SRC, 'style.css'), path.join(RESOURCES, 'style.css'));

  // 1a. Copy client.html (server UI)
  copy(path.join(ROOT, 'server', 'client.html'), path.join(RESOURCES, 'client.html'));

  // 1b. Copy favicon
  copy(path.join(DESKTOP_SRC, 'favicon.ico'), path.join(RESOURCES, 'favicon.ico'));

  if (!isDev) {
    // ------------------------------------------------------------
    // 2. Copy server binary for embedding
    // ------------------------------------------------------------
    copy(serverExe, path.join(RESOURCES, 'gyroclopter-server.exe'));

    // ------------------------------------------------------------
    // 3. Copy tray icon
    // ------------------------------------------------------------
    fs.mkdirSync(path.join(RESOURCES, 'icons'), { recursive: true });
    copy(path.join(ICONS_DIR, '32x32.png'), path.join(RESOURCES, 'icons', 'trayIcon.png'));

    // ------------------------------------------------------------
    // 4. Run neu build with resource embedding
    // ------------------------------------------------------------
    const neu = path.join(
      ROOT,
      'node_modules',
      '.bin',
      process.platform === 'win32' ? 'neu.cmd' : 'neu'
    );

    console.log(`> "${neu}" build --release --embed-resources`);
    const r = spawnSync(`"${neu}"`, ['build', '--release', '--embed-resources'], {
      cwd: ROOT,
      stdio: 'inherit',
      shell: true
    });

    if (r.status !== 0) {
      console.error(`neu build exited with code ${r.status}`);
      process.exit(r.status ?? 1);
    }

    // ------------------------------------------------------------
    // 4b. Extract Neutralino ZIP output (required for resources.neu)
    // ------------------------------------------------------------
    const zipSuffix = isDev ? '' : '-release';
    const zipPath = path.join(DIST, `${BINARY_NAME}${zipSuffix}.zip`);
    const builtDir = path.join(DIST, BINARY_NAME);

    if (fs.existsSync(zipPath)) {
      console.log(`Extracting ${zipPath}...`);
      const AdmZip = require('adm-zip');
      const zip = new AdmZip(zipPath);
      zip.extractAllTo(builtDir, true);
      console.log('✓ Extracted Neutralino ZIP (resources.neu now available)');
    } else {
      console.error('ERROR: Neutralino ZIP missing — cannot extract resources.neu');
      process.exit(1);
    }

    // ------------------------------------------------------------
    // 5. Copy platform-specific built binary to dist/<binaryName>.exe
    // ------------------------------------------------------------
    const platformSuffixes = {
      win32: 'win_x64.exe',
      linux: 'linux_x64',
      darwin: 'mac_x64'
    };
    const suffix = platformSuffixes[process.platform] || 'win_x64.exe';
    const builtExe = path.join(builtDir, `${BINARY_NAME}-${suffix}`);
    const destExe = path.join(DIST, `${BINARY_NAME}${process.platform === 'win32' ? '.exe' : ''}`);

    if (fs.existsSync(builtExe)) {
      copy(builtExe, destExe);

      // Ensure resources.neu exists
      const neuBundle = path.join(builtDir, 'resources.neu');
      if (!fs.existsSync(neuBundle)) {
        console.error('ERROR: resources.neu missing — Neutralino cannot run.');
        process.exit(1);
      }

      // ------------------------------------------------------------
      // 6. Copy entire Neutralino runtime folder
      // ------------------------------------------------------------
      const finalDir = path.join(DIST, BINARY_NAME);
      fs.mkdirSync(finalDir, { recursive: true });

      for (const file of fs.readdirSync(builtDir)) {
        const src = path.join(builtDir, file);
        const dst = path.join(finalDir, file);
        copy(src, dst);
      }

      console.log('✓ Full Neutralino runtime copied (including resources.neu)');
    } else {
      console.error(`Expected build output not found: ${builtExe}`);
      console.error('Check neutralino.config.json cli.binaryName.');
      process.exit(1);
    }
  }
}

main();
