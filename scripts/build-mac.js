const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');
const sharp = require('sharp');

const root = path.join(__dirname, '..');
const source = path.join(root, 'build', 'icon-source.png');
const iconset = path.join(root, 'build', 'icon.iconset');
const output = path.join(root, 'build', 'macos');

/** Run a native build tool and fail with its diagnostic output. */
function run(command, args) {
  const result = spawnSync(command, args, { stdio: 'inherit' });
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error(`${command} exited with ${result.status}`);
}

/** Build a universal CoreGraphics helper and a macOS application icon. */
async function main() {
  if (process.platform !== 'darwin') throw new Error('Mac packages must be built on macOS');
  fs.mkdirSync(output, { recursive: true });
  fs.mkdirSync(iconset, { recursive: true });
  for (const size of [16, 32, 128, 256, 512]) {
    for (const scale of [1, 2]) {
      const pixels = size * scale;
      const name = `icon_${size}x${size}${scale === 2 ? '@2x' : ''}.png`;
      await sharp(source).resize(pixels, pixels).png().toFile(path.join(iconset, name));
    }
  }
  run('iconutil', ['-c', 'icns', iconset, '-o', path.join(root, 'build', 'icon.icns')]);
  run('clang', [
    '-O2', '-Wall', '-Wextra', '-arch', 'arm64', '-arch', 'x86_64',
    '-mmacosx-version-min=11.0',
    path.join(root, 'native', 'macos-mouse.c'),
    '-framework', 'ApplicationServices',
    '-o', path.join(output, 'gyroclopter-mouse')
  ]);
  run('file', [path.join(output, 'gyroclopter-mouse')]);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
