const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const history = '# [0.6.0](https://example.com/v0.6.0) (2026-11-01)\n\n- An older release.\n';
const pending = '### Fixed\n\n- Restored pointer movement after a reconnect.\n';
let checkout;

/** Run the packaged CLI against a disposable checkout. */
function release(...args) {
  return spawnSync(process.execPath, [path.join(checkout, 'scripts/release.js'), ...args], {
    encoding: 'utf8',
  });
}

beforeEach(() => {
  checkout = fs.mkdtempSync(path.join(os.tmpdir(), 'gyroclopter-release-'));
  fs.mkdirSync(path.join(checkout, 'scripts'));
  fs.copyFileSync(path.join(__dirname, '../scripts/release.js'), path.join(checkout, 'scripts/release.js'));
  const manifest = { name: 'gyroclopter', version: '0.6.0' };
  const lock = { ...manifest, lockfileVersion: 3, packages: { '': manifest } };
  fs.writeFileSync(path.join(checkout, 'package.json'), JSON.stringify(manifest, null, 2));
  fs.writeFileSync(path.join(checkout, 'package-lock.json'), JSON.stringify(lock, null, 2));
  fs.writeFileSync(path.join(checkout, 'CHANGELOG.md'), `# Changelog\n\n## [Unreleased]\n\n${pending}\n${history}`);
});

afterEach(() => fs.rmSync(checkout, { recursive: true, force: true }));

test('prepares one release, preserves history, and prints only its notes', () => {
  expect(release('preview').stdout).toBe(pending);
  expect(release('prepare', '0.7.0').status).toBe(0);
  expect(release('check').status).toBe(0);
  expect(release('preview').stdout).toBe('No unreleased changes recorded.\n');
  expect(fs.readFileSync(path.join(checkout, 'CHANGELOG.md'), 'utf8').endsWith(history)).toBe(true);

  const notes = release('notes', 'v0.7.0');
  expect(notes.status).toBe(0);
  expect(notes.stdout).toBe(`${pending}\n[Full changelog](https://github.com/ryanraposo/gyroclopter/compare/v0.6.0...v0.7.0)\n`);
  expect(release('notes', 'v0.6.0').status).toBe(1);
});

test('rejects an unfrozen release or an invalid bump without changing the pending notes', () => {
  expect(release('notes', 'v0.6.0').status).toBe(1);
  expect(release('prepare', '0.5.9').status).toBe(1);
  expect(release('prepare', '0.7.0-rc.1').status).toBe(1);
  expect(release('preview').stdout).toBe(pending);
});

test('rejects drift in the root package-lock version', () => {
  const file = path.join(checkout, 'package-lock.json');
  const lock = JSON.parse(fs.readFileSync(file, 'utf8'));
  lock.packages[''].version = '0.5.0';
  fs.writeFileSync(file, JSON.stringify(lock));
  expect(release('check').stderr).toContain('package-lock.json versions must match');
});
