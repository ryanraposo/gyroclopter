const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const src = path.join(root, 'web-pilot');
const dist = path.join(root, 'dist');

const common = [
  'service-worker.js',
  'interaction-field.js',
  'content.js',
  'content.css'
];
const icons = ['16.png','32.png','48.png','128.png'];

function copy(file, from, to) {
  fs.mkdirSync(path.dirname(to), { recursive: true });
  fs.copyFileSync(from || path.join(src, file), to);
}
function build(name, manifest, popupHtml, popupJs) {
  const out = path.join(dist, name);
  fs.rmSync(out, { recursive: true, force: true });
  fs.mkdirSync(out, { recursive: true });
  for (const file of common) copy(file, null, path.join(out, file));
  for (const icon of icons) copy(icon, path.join(src, 'icons', icon), path.join(out, 'icons', icon));
  copy(manifest, null, path.join(out, 'manifest.json'));
  copy(popupHtml, null, path.join(out, popupHtml));
  copy(popupJs, null, path.join(out, popupJs));
}
build('web-pilot', 'manifest.json', 'popup.html', 'popup.js');
build('web-pilot-full', 'manifest.full.json', 'popup.html', 'popup.js');
build('web-pilot-skunk', 'manifest.skunk.json', 'popup-skunk.html', 'popup-skunk.js');
console.log('Built Web Pilot: standard, full, skunk');
