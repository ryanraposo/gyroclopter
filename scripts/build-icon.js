const fs = require('fs');
const path = require('path');
const sharp = require('sharp');
const { execSync } = require('child_process');

const SOURCE = path.join(__dirname, '..', 'build', 'icon-source.png');
const ICONS_DIR = path.join(__dirname, '..', 'build', 'icons');
const ICO_PATH = path.join(__dirname, '..', 'build', 'icon.ico');
const FAVICON_PATH = path.join(__dirname, '..', 'app', 'favicon.ico');

// Sizes for Linux PNG icons
const SIZES = [16, 32, 48, 64, 128, 256, 512];
// Sizes for Windows ICO
const ICO_SIZES = [16, 32, 48, 64, 128, 256];

async function resizeIcon(size) {
  const sigma = size <= 32 ? 1.5 : size <= 64 ? 1.0 : 0.5;
  return await sharp(SOURCE)
    .resize(size, size, {
      fit: 'fill',
      kernel: 'lanczos3',
    })
    .sharpen({
      sigma,
      m1: 1.0,
      m2: 0.0,
    })
    .png({ compressionLevel: 9 })
    .toBuffer();
}

async function main() {
  if (!fs.existsSync(SOURCE)) {
    console.error(`Source image not found: ${SOURCE}`);
    process.exit(1);
  }

  const sourceStats = fs.statSync(SOURCE);
  console.log(`Source: ${SOURCE} (${sourceStats.size} bytes)`);

  // Create icons directory
  if (!fs.existsSync(ICONS_DIR)) {
    fs.mkdirSync(ICONS_DIR, { recursive: true });
  }

  // Generate PNG icons with Lanczos resampling and sharpening
  for (const size of SIZES) {
    const outputPath = path.join(ICONS_DIR, `${size}x${size}.png`);
    const buffer = await resizeIcon(size);
    fs.writeFileSync(outputPath, buffer);
    const stats = fs.statSync(outputPath);
    console.log(`  wrote ${outputPath} (${stats.size} bytes)`);
  }

  // Generate PNGs for ICO embedding
  const icoPngPaths = [];
  for (const size of ICO_SIZES) {
    const buffer = await resizeIcon(size);
    const tempPath = path.join(ICONS_DIR, `.ico-${size}.png`);
    fs.writeFileSync(tempPath, buffer);
    icoPngPaths.push(tempPath);
  }

  // Use icotool to create multi-size ICO
  execSync(`icotool --create -o "${ICO_PATH}" ${icoPngPaths.join(' ')}`);
  const icoStats = fs.statSync(ICO_PATH);
  console.log(`  wrote ${ICO_PATH} (${icoStats.size} bytes)`);

  // Cleanup temp files
  icoPngPaths.forEach(p => fs.unlinkSync(p));

  // Copy ICO to favicon
  fs.copyFileSync(ICO_PATH, FAVICON_PATH);
  console.log(`  wrote ${FAVICON_PATH} (${icoStats.size} bytes)`);

  // Generate optimized favicon PNG (32x32 is standard for browsers)
  const faviconPngPath = path.join(__dirname, '..', 'app', 'favicon.png');
  const faviconBuffer = await resizeIcon(32);
  fs.writeFileSync(faviconPngPath, faviconBuffer);
  const pngStats = fs.statSync(faviconPngPath);
  console.log(`  wrote ${faviconPngPath} (${pngStats.size} bytes)`);
  
  console.log('\nIcon generation complete!');
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});