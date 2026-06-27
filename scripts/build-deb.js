/**
 * Build a Debian package around the Linux SEA binary using dpkg-deb.
 * Output: dist/gyroclopter_<version>_amd64.deb
 *
 * Requires: build:sea (dist/gyroclopter-<version>), build:icons (build/icons/<N>x<N>.png)
 */
const fs = require('fs');
const path = require('path');
const os = require('os');
const { spawnSync } = require('child_process');

const ROOT = path.join(__dirname, '..');
const PKG = require(path.join(ROOT, 'package.json'));
const VERSION = PKG.version;
const APP = PKG.name;

const BIN_NAME = `${APP}-${VERSION}`;
const BIN_SRC = path.join(ROOT, 'dist', BIN_NAME);
const STAGE = path.join(os.tmpdir(), `${APP}-deb-${process.pid}`);
const OUT = path.join(ROOT, 'dist', `${APP}_${VERSION}_amd64.deb`);

function cp(src, dst) {
  fs.mkdirSync(path.dirname(dst), { recursive: true });
  fs.copyFileSync(src, dst);
}

function write(p, content) {
  fs.mkdirSync(path.dirname(p), { recursive: true });
  fs.writeFileSync(p, content);
}

function rmdir(p) {
  if (fs.existsSync(p)) fs.rmSync(p, { recursive: true, force: true });
}

function findIcon() {
  const dir = path.join(ROOT, 'build', 'icons');
  for (const sz of [256, 128, 64, 48, 32]) {
    const p = path.join(dir, `${sz}x${sz}.png`);
    if (fs.existsSync(p)) return p;
  }
  return null;
}

function main() {
  if (!fs.existsSync(BIN_SRC)) {
    console.error(`Missing ${BIN_SRC} — run "npm run build:sea" first.`);
    process.exit(1);
  }

  rmdir(STAGE);

  // DEBIAN control + conffiles
  const control = [
    `Package: ${APP}`,
    `Version: ${VERSION}`,
    `Section: utils`,
    `Priority: optional`,
    `Architecture: amd64`,
    `Maintainer: ${PKG.author.name} <${PKG.author.email}>`,
    `Homepage: ${PKG.homepage}`,
    `Description: ${PKG.description}`,
    ' Gyroclopter turns a mobile phone into a wireless gyroscopic',
    ' air mouse for a Linux desktop via HTTPS/WebSocket.',
    ''
  ].join('\n');
  write(path.join(STAGE, 'DEBIAN', 'control'), control);

  write(path.join(STAGE, 'DEBIAN', 'conffiles'), '');

  // Binary
  cp(BIN_SRC, path.join(STAGE, 'usr', 'bin', APP));
  fs.chmodSync(path.join(STAGE, 'usr', 'bin', APP), 0o755);

  // Desktop entry
  const desktop = [
    '[Desktop Entry]',
    'Type=Application',
    `Name=Gyroclopter`,
    'Comment=Wireless gyroscopic air mouse server',
    `Exec=${APP}`,
    'Terminal=true',
    'Categories=Utility;Network;',
    `Keywords=mouse;gyroscope;remote;`,
    ''
  ].join('\n');
  write(path.join(STAGE, 'usr', 'share', 'applications', `${APP}.desktop`), desktop);

  // Icon (highest-resolution PNG that exists)
  const iconSrc = findIcon();
  if (iconSrc) {
    cp(iconSrc, path.join(STAGE, 'usr', 'share', 'icons', 'hicolor', '256x256', 'apps', `${APP}.png`));
  }

  // Build
  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  const r = spawnSync('dpkg-deb', ['--build', STAGE, OUT], { stdio: 'inherit' });
  if (r.status !== 0) {
    console.error(`dpkg-deb exited with code ${r.status}`);
    rmdir(STAGE);
    process.exit(r.status ?? 1);
  }

  rmdir(STAGE);
  const size = fs.statSync(OUT).size;
  console.log(`✓ Built ${OUT} (${(size / 1024 / 1024).toFixed(2)} MB)`);
}

main();