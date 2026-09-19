const fs = require('fs');
const path = require('path');
const vm = require('vm');

const root = path.resolve(__dirname, '..');
function readJson(file) { return JSON.parse(fs.readFileSync(file, 'utf8')); }
function assert(ok, message) { if (!ok) throw new Error(message); }
function parseJs(file) { new vm.Script(fs.readFileSync(file, 'utf8'), { filename: file }); }

const standard = readJson(path.join(root, 'dist/web-pilot/manifest.json'));
const full = readJson(path.join(root, 'dist/web-pilot-full/manifest.json'));
const skunk = readJson(path.join(root, 'dist/web-pilot-skunk/manifest.json'));

assert(!standard.permissions.includes('debugger'), 'standard build must not require debugger');
assert((standard.optional_host_permissions || []).length > 0, 'standard build should request hosts at runtime');
assert(full.permissions.includes('debugger'), 'full build must declare debugger');
assert(skunk.permissions.includes('debugger'), 'skunk build keeps full-control fallback available');
assert((skunk.host_permissions || []).includes('https://*/*'), 'skunk build must have ambient HTTPS access');
assert((skunk.host_permissions || []).includes('http://*/*'), 'skunk build must have ambient HTTP access');
assert(Array.isArray(skunk.content_scripts) && skunk.content_scripts.length === 1, 'skunk build must auto-inject');
assert(skunk.content_scripts[0].matches.includes('https://*/*'), 'skunk build must auto-run on HTTPS pages');

for (const file of [
  'web-pilot/service-worker.js',
  'web-pilot/interaction-field.js',
  'web-pilot/content.js',
  'web-pilot/popup.js',
  'web-pilot/popup-skunk.js',
  'web-pilot/controller.js',
  'web-pilot/dev-server.js',
  'docs/controller.js',
  'scripts/build-web-pilot.js'
]) parseJs(path.join(root, file));

for (const file of ['docs/index.html','docs/controller.css','docs/controller.js','docs/.nojekyll']) {
  assert(fs.existsSync(path.join(root, file)), 'missing Pages asset: ' + file);
}
console.log('Web Pilot verification passed');
