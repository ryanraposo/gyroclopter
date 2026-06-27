#!/usr/bin/env node
/**
 * Generate electron-builder icon assets from build/icon-source.png.
 *
 * Writes:
 *   build/icons/<N>x<N>.png  for N in 16, 32, 48, 64, 128, 256, 512, 1024
 *   build/icon.png           (512x512, used by electron-builder as a generic fallback)
 *
 * Resampling uses box-filter averaging, which gives clean downscaling for
 * flat-ish app icons without introducing ringing artifacts.
 */

const fs = require('fs');
const path = require('path');
const { PNG } = require('pngjs');

const ROOT = path.resolve(__dirname, '..');
const SRC = path.join(ROOT, 'build', 'icon-source.png');
const ICONS_DIR = path.join(ROOT, 'build', 'icons');
const FALLBACK = path.join(ROOT, 'build', 'icon.png');

const SIZES = [16, 32, 48, 64, 128, 256, 512, 1024];

function resample(srcPng, targetSize) {
  const dst = new PNG({ width: targetSize, height: targetSize });
  const sx = srcPng.width / targetSize;
  const sy = srcPng.height / targetSize;

  for (let y = 0; y < targetSize; y++) {
    const y0 = Math.floor(y * sy);
    const y1 = Math.max(y0 + 1, Math.floor((y + 1) * sy));
    for (let x = 0; x < targetSize; x++) {
      const x0 = Math.floor(x * sx);
      const x1 = Math.max(x0 + 1, Math.floor((x + 1) * sx));

      let r = 0, g = 0, b = 0, a = 0, count = 0;
      for (let yy = y0; yy < y1; yy++) {
        for (let xx = x0; xx < x1; xx++) {
          const idx = (yy * srcPng.width + xx) << 2;
          r += srcPng.data[idx];
          g += srcPng.data[idx + 1];
          b += srcPng.data[idx + 2];
          a += srcPng.data[idx + 3];
          count++;
        }
      }

      const di = (y * targetSize + x) << 2;
      dst.data[di] = Math.round(r / count);
      dst.data[di + 1] = Math.round(g / count);
      dst.data[di + 2] = Math.round(b / count);
      dst.data[di + 3] = Math.round(a / count);
    }
  }
  return dst;
}

function main() {
  if (!fs.existsSync(SRC)) {
    console.error(`Missing source icon: ${SRC}`);
    process.exit(1);
  }

  fs.mkdirSync(ICONS_DIR, { recursive: true });

  const srcBuf = fs.readFileSync(SRC);
  const srcPng = PNG.sync.read(srcBuf);

  if (srcPng.width !== srcPng.height) {
    console.error(`Source icon must be square, got ${srcPng.width}x${srcPng.height}`);
    process.exit(1);
  }

  for (const size of SIZES) {
    const out = resample(srcPng, size);
    const outPath = path.join(ICONS_DIR, `${size}x${size}.png`);
    fs.writeFileSync(outPath, PNG.sync.write(out));
    console.log(`wrote ${path.relative(ROOT, outPath)}`);
  }

  if (srcPng.width !== 512) {
    const fallback = resample(srcPng, 512);
    fs.writeFileSync(FALLBACK, PNG.sync.write(fallback));
  } else {
    fs.copyFileSync(SRC, FALLBACK);
  }
  console.log(`wrote ${path.relative(ROOT, FALLBACK)}`);
}

main();
