const { once } = require('events');
const WebSocket = require('ws');
const ChromeOSInputController = require('../platforms/desktop/chromeos/input');
const { isUsableIpv4 } = ChromeOSInputController;
const { resolveInputBackend, describeInputBackend } = require('../input');
const token = 'ab'.repeat(24);
const hello = (overrides = {}) => JSON.stringify({ type: 'hello', protocol: 1, token, automationReady: true, ...overrides });
let controller;
let clients;

beforeEach(() => { clients = []; });
afterEach(async () => {
  for (const client of clients) client.terminate();
  if (controller) {
    const closed = once(controller.server, 'close');
    controller.dispose();
    await closed;
    controller = null;
  }
});

async function connect() {
  const client = new WebSocket('ws://127.0.0.1:' + controller.port);
  clients.push(client);
  await once(client, 'open');
  return client;
}

async function start(options = {}) {
  controller = new ChromeOSInputController({ bridgePort: 0, bridgeToken: token, ...options });
  await once(controller.server, 'listening');
}

test('explicit experimental selection preserves Linux default', () => {
  expect(resolveInputBackend({ platform: 'linux', env: {} })).toBe('linux');
  expect(resolveInputBackend({ platform: 'linux', env: { GYROCLOPTER_INPUT_BACKEND: 'chromeos' } })).toBe('chromeos');
  expect(describeInputBackend({ adapterId: 'chromeos', env: {} }).scope).toBe('system-semantic');
  expect(() => new ChromeOSInputController({ env: {} })).toThrow('requires');
});

test('address validation rejects non-unicast and malformed values', () => {
  expect(isUsableIpv4('192.168.1.42')).toBe(true);
  for (const ip of ['127.0.0.1','169.254.1.4','224.0.0.1','not-an-ip','10..2.3']) expect(isUsableIpv4(ip)).toBe(false);
});

test('rejects wrong token without exposing input or readiness', async () => {
  await start();
  const client = await connect();
  const closed = once(client, 'close');
  client.send(hello({ token: '00'.repeat(24) }));
  expect((await closed)[0]).toBe(1008);
  expect(controller.available).toBe(false);
});

test('authenticated readiness, address updates, input delivery and disconnect', async () => {
  const addresses = [];
  await start({ onPairingAddress: ip => addresses.push(ip) });
  const client = await connect();
  expect(controller.available).toBe(false);
  let message = once(client, 'message');
  client.send(hello({ automationReady: false, hostIp: '192.168.1.42' }));
  expect(JSON.parse((await message)[0].toString())).toEqual({ type: 'ready', automationReady: false });
  expect(controller.available).toBe(false);
  message = once(client, 'message');
  client.send(hello());
  expect(JSON.parse((await message)[0].toString()).automationReady).toBe(true);
  expect(controller.available).toBe(true);
  expect(addresses).toEqual(['192.168.1.42']);
  message = once(client, 'message');
  controller.sendCommand('MOVE 12 -4');
  expect(JSON.parse((await message)[0].toString())).toEqual({ type: 'input', command: 'MOVE 12 -4' });
  const unavailable = once(controller, 'availability');
  client.close();
  expect((await unavailable)[0]).toBe(false);
});
