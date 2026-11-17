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

test('depth warp tilts the rotor plane and trails the blades while running', async ({ page }) => {
  await openMacUI(page);
  const assembly = page.locator('.mac-rotor-assembly');
  const echoes = page.locator('.rotor-echo');

  expect(await assembly.evaluate(el => getComputedStyle(el).transform)).toBe('none');
  expect(await echoes.first().evaluate(el => getComputedStyle(el).opacity)).toBe('0');

  await page.evaluate(() => setStatus(true));
  await expect.poll(() =>
    assembly.evaluate(el => getComputedStyle(el).transform)
  ).toContain('matrix3d');
  const readWarp = () => assembly.evaluate(el => {
    const nums = getComputedStyle(el).transform.match(/-?[\d.]+/g).map(Number);
    return nums[6]; // matrix3d m22: vertical scale of the tilted rotation plane
  });
  await expect.poll(readWarp).toBeLessThan(0.4); // wait out the 260ms tilt transition
  const warp = await readWarp();
  expect(warp).toBeGreaterThan(0.3);
  await expect.poll(() =>
    echoes.first().evaluate(el => parseFloat(getComputedStyle(el).opacity))
  ).toBeGreaterThan(0.15);
  const delays = await echoes.evaluateAll(els =>
    els.map(el => getComputedStyle(el).animationDelay)
  );
  expect(delays).toEqual(['-0.045s', '-0.09s']);

  await page.evaluate(() => setStatus(false));
  await expect.poll(() =>
    echoes.first().evaluate(el => parseFloat(getComputedStyle(el).opacity))
  ).toBe(0);
  await expect.poll(() =>
    assembly.evaluate(el => getComputedStyle(el).transform)
  ).toBe('none');
});

test('reduced-motion users see a static rotor', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await openMacUI(page);
  await page.evaluate(() => setStatus(true));
  expect(await rotorStyle(page, 'animationName')).toBe('none');
});
