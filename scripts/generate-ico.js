#!/usr/bin/env node
/**
 * Build build/icon.ico from build/icons/<N>x<N>.png assets.
 *
 * Uses the PNG-in-ICO container format (supported by Windows Vista and
 * electron-builder's NSIS target). Includes 16, 32, 48, 64, 128, 256.
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const ICONS_DIR = path.join(ROOT, 'build', 'icons');
const OUT = path.join(ROOT, 'build', 'icon.ico');

const SIZES = [16, 32, 48, 64, 128, 256];

function main() {
  const images = SIZES.map((size) => {
    const file = path.join(ICONS_DIR, `${size}x${size}.png`);
    const buf = fs.readFileSync(file);
    return { size, buf };
  });

  const ICONDIR_SIZE = 6;
  const ICONDIRENTRY_SIZE = 16;
  const headerSize = ICONDIR_SIZE + ICONDIRENTRY_SIZE * images.length;

  let offset = headerSize;
  const entries = images.map(({ size, buf }) => {
    const entry = Buffer.alloc(ICONDIRENTRY_SIZE);
    entry.writeUInt8(size >= 256 ? 0 : size, 0);
    entry.writeUInt8(size >= 256 ? 0 : size, 1);
    entry.writeUInt8(0, 2);
    entry.writeUInt8(0, 3);
    entry.writeUInt16LE(1, 4);
    entry.writeUInt16LE(32, 6);
    entry.writeUInt32LE(buf.length, 8);
    entry.writeUInt32LE(offset, 12);
    offset += buf.length;
    return entry;
  });

  const header = Buffer.alloc(ICONDIR_SIZE);
  header.writeUInt16LE(0, 0);
  header.writeUInt16LE(1, 2);
  header.writeUInt16LE(images.length, 4);

  const out = Buffer.concat([header, ...entries, ...images.map((i) => i.buf)]);
  fs.writeFileSync(OUT, out);
  console.log(`wrote ${path.relative(ROOT, OUT)} (${out.length} bytes)`);
}

main();
