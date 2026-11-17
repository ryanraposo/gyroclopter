const path = require('path');
const { test, expect } = require('@playwright/test');

// This host already has Chrome; do not download Playwright's Chromium.
test.use({
  launchOptions: { executablePath: '/usr/bin/google-chrome', args: ['--no-sandbox'] },
  viewport: { width: 900, height: 900 }
});

const APP_URL = 'file://' + path.resolve(__dirname, '../../app/index.html');

async function openMacUI(page) {
  await page.addInitScript(() => {
    window.electronAPI = {
      platform: 'darwin',
      startServer() {},
      stopServer() {},
      onServerEvent() {},
      onServerExit() {}
    };
  });
  await page.goto(APP_URL);
}

function rotorStyle(page, prop) {
  return page.locator('.mac-rotor').evaluate(
    (el, name) => getComputedStyle(el)[name], prop
  );
}

test('rotor exists, is still, and sits on the hub while the server is stopped', async ({ page }) => {
  await openMacUI(page);
  await expect(page.locator('.mac-rotor')).toHaveCount(1);
  expect(await rotorStyle(page, 'animationName')).toBe('rotor-spin');
  expect(await rotorStyle(page, 'animationPlayState')).toBe('paused');
  const origin = await rotorStyle(page, 'transformOrigin'); // e.g. "243.72px 101.02px"
  const [ox, oy] = origin.split(' ').map(parseFloat);
  expect(Math.abs(ox - 243.7)).toBeLessThan(1);
  expect(Math.abs(oy - 101.0)).toBeLessThan(1);
});

test('rotor spins while the server runs and speeds up on a connection', async ({ page }) => {
  await openMacUI(page);
  expect(await rotorStyle(page, 'animationPlayState')).toBe('paused');

  await page.evaluate(() => setStatus(true));
  expect(await rotorStyle(page, 'animationPlayState')).toBe('running');

  await page.evaluate(() => setConnectedCount(1));
  expect(await rotorStyle(page, 'animationDuration')).toBe('0.45s');

  await page.evaluate(() => setStatus(false));
  expect(await rotorStyle(page, 'animationPlayState')).toBe('paused');
  expect(await rotorStyle(page, 'animationDuration')).toBe('1.4s');
});

test('reduced-motion users see a static rotor', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await openMacUI(page);
  await page.evaluate(() => setStatus(true));
  expect(await rotorStyle(page, 'animationName')).toBe('none');
});
