/**
 * Builds Windows .ico and Linux .png icon assets from build/icon-source.png.
 *
 * Outputs:
 *   build/icon.ico     (multi-size: 16, 32, 48, 64, 128, 256)
 *   build/icons/<N>x<N.png  (16, 32, 48, 64, 128, 256, 512 — for nfpm/Linux)
 */
const fs = require('fs');
const path = require('path');
const { PNG } = require('pngjs');

const ROOT = path.join(__dirname, '..');
const SOURCE = path.join(ROOT, 'build', 'icon-source.png');
const BUILD = path.join(ROOT, 'build');
const ICONS_DIR = path.join(BUILD, 'icons');

const SIZES = [16, 32, 48, 64, 128, 256];

function resizePng(buffer, size) {
  const src = PNG.sync.read(buffer);
  const dst = new PNG({ width: size, height: size, colorType: 6 });
  for (let y = 0; y < size; y++) {
    const sy = Math.floor((y + 0.5) * src.height / size);
    for (let x = 0; x < size; x++) {
      const sx = Math.floor((x + 0.5) * src.width / size);
      const srcIdx = (sy * src.width + sx) << 2;
      const dstIdx = (y * size + x) << 2;
      dst.data[dstIdx] = src.data[srcIdx];
      dst.data[dstIdx + 1] = src.data[srcIdx + 1];
      dst.data[dstIdx + 2] = src.data[srcIdx + 2];
      dst.data[dstIdx + 3] = src.data[srcIdx + 3];
    }
  }
  return PNG.sync.write(dst);
}

/**
 * Build a Windows .ico containing PNG-encoded entries (Vista+ format).
 * Spec: https://en.wikipedia.org/wiki/ICO_(file_format)
 */
function buildIco(pngBuffers) {
  const count = pngBuffers.length;
  const headerLen = 6;
  const dirLen = 16 * count;
  const header = Buffer.alloc(headerLen);
  header.writeUInt16LE(0, 0);
  header.writeUInt16LE(1, 2);
  header.writeUInt16LE(count, 4);

  const sizes = pngBuffers.map(buf => {
    const png = PNG.sync.read(buf);
    return png.width;
  });

  let offset = headerLen + dirLen;
  const dirEntries = pngBuffers.map((buf, i) => {
    const size = sizes[i];
    const e = Buffer.alloc(16);
    e.writeUInt8(size >= 256 ? 0 : size, 0);
    e.writeUInt8(size >= 256 ? 0 : size, 1);
    e.writeUInt8(0, 2);
    e.writeUInt8(0, 3);
    e.writeUInt16LE(1, 4);
    e.writeUInt16LE(32, 6);
    e.writeUInt32LE(buf.length, 8);
    e.writeUInt32LE(offset, 12);
    offset += buf.length;
    return e;
  });

  return Buffer.concat([header, ...dirEntries, ...pngBuffers]);
}

function main() {
  if (!fs.existsSync(SOURCE)) {
    console.error(`Source icon not found: ${SOURCE}`);
    process.exit(1);
  }
  fs.mkdirSync(ICONS_DIR, { recursive: true });

  const sourceBuf = fs.readFileSync(SOURCE);
  console.log(`Source: ${SOURCE} (${sourceBuf.length} bytes)`);

  const pngBuffers = [];
  for (const size of SIZES) {
    const buf = resizePng(sourceBuf, size);
    const out = path.join(ICONS_DIR, `${size}x${size}.png`);
    fs.writeFileSync(out, buf);
    pngBuffers.push(buf);
    console.log(`  wrote ${out} (${buf.length} bytes)`);
  }

  fs.copyFileSync(SOURCE, path.join(ICONS_DIR, '512x512.png'));
  console.log(`  wrote ${path.join(ICONS_DIR, '512x512.png')}`);

  const ico = buildIco(pngBuffers);
  const icoPath = path.join(BUILD, 'icon.ico');
  fs.writeFileSync(icoPath, ico);
  console.log(`  wrote ${icoPath} (${ico.length} bytes)`);
}

main();