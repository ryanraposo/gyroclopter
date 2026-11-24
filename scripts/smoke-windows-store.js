const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { once } = require('node:events');
const { _electron } = require('playwright');
const WebSocket = require('ws');

async function smoke() {
  const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'gyroclopter-store-smoke-'));
  const executablePath = path.resolve('dist/store/win-unpacked/Gyroclopter.exe');
  let desktop;
  let phone;

  try {
    desktop = await _electron.launch({
      executablePath,
      args: [`--user-data-dir=${profile}`],
      env: { ...process.env, PORT: '0' }
    });
    const window = await desktop.firstWindow();
    await window.locator('body.illustrated.store').waitFor();
    assert.equal(await window.locator('#status-text').textContent(), 'Stopped');

    const start = window.getByRole('button', { name: 'Start Server' });
    await start.click();
    const status = window.locator('#status-text');
    await status.filter({ hasText: /^Running$/ }).waitFor();
    await window.locator('#qr-canvas img').waitFor();

    const copy = window.getByRole('button', { name: 'Copy pairing link' });
    await copy.click();
    await window.getByRole('button', { name: 'Link copied' }).waitFor();
    const copied = await desktop.evaluate(({ clipboard }) => clipboard.readText());
    const link = new URL(copied);
    const key = /^#pair=([a-f0-9]{32})$/.exec(link.hash)?.[1];
    assert.ok(key, 'The copy button must provide a paired session link.');

    phone = new WebSocket(`wss://127.0.0.1:${link.port}/pair/${key}`, {
      rejectUnauthorized: false,
      handshakeTimeout: 5000
    });
    await once(phone, 'open');
    await window.getByText('1 device connected').waitFor();
    await window.getByRole('button', { name: 'Stop Server' }).click();
    await start.waitFor();
    await status.filter({ hasText: /^Stopped$/ }).waitFor();
    console.log('Packaged Store app opened, paired, and stopped its server.');
  } finally {
    if (phone?.readyState === WebSocket.OPEN) phone.terminate();
    await desktop?.close();
    fs.rmSync(profile, { recursive: true, force: true, maxRetries: 3 });
  }
}

smoke().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
