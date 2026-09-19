const WebSocket = require('ws');
const ChromeOSInputController = require('../input/chromeos');
const { resolveInputBackend } = require('../input');

describe('ChromeOS input bridge', () => {
  test('selects ChromeOS only when explicitly requested', () => {
    expect(resolveInputBackend({
      platform: 'linux',
      env: { GYROCLOPTER_INPUT_BACKEND: 'chromeos' }
    })).toBe('chromeos');
  });

  test('relays stable input commands to localhost bridge clients', (done) => {
    const controller = new ChromeOSInputController({ bridgePort: 0 });

    controller.server.on('listening', () => {
      const ws = new WebSocket(`ws://127.0.0.1:${controller.port}`);

      ws.on('message', (raw) => {
        const message = JSON.parse(raw.toString());
        if (message.type !== 'input') return;

        try {
          expect(message.command).toBe('MOVE 12 -4');
          expect(controller.available).toBe(true);
          ws.close();
          controller.dispose();
          done();
        } catch (err) {
          ws.close();
          controller.dispose();
          done(err);
        }
      });

      ws.on('open', () => {
        controller.sendCommand('MOVE 12 -4');
      });

      ws.on('error', (err) => {
        controller.dispose();
        done(err);
      });
    });
  });
});
