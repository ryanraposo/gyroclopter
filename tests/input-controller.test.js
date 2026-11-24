const { dispatchInputMessage } = require('../input/commands');
const { resolveInputBackend } = require('../input');

describe('input backend architecture', () => {
  test('translates validated transport messages into stable commands', () => {
    const sent = [];
    const controller = { sendCommand: command => sent.push(command) };

    expect(dispatchInputMessage({ type: 'move', dx: 10.4, dy: -2.2 }, controller, 1.2)).toBe(true);
    expect(dispatchInputMessage({ type: 'down' }, controller, 1.2)).toBe(true);
    expect(dispatchInputMessage({ type: 'up' }, controller, 1.2)).toBe(true);
    expect(dispatchInputMessage({ type: 'right' }, controller, 1.2)).toBe(true);
    expect(dispatchInputMessage({ type: 'scroll', delta: -12.8 }, controller, 1.2)).toBe(true);

    expect(sent).toEqual([
      'MOVE 12 -3',
      'LEFT_DOWN',
      'LEFT_UP',
      'CLICK_RIGHT',
      'SCROLL -12'
    ]);
  });

  test('rejects malformed or unknown messages', () => {
    const sent = [];
    const controller = { sendCommand: command => sent.push(command) };

    expect(dispatchInputMessage({ type: 'move', dx: '10', dy: 2 }, controller, 1.2)).toBe(false);
    expect(dispatchInputMessage({ type: 'scroll', delta: NaN }, controller, 1.2)).toBe(false);
    expect(dispatchInputMessage({ type: 'wat' }, controller, 1.2)).toBe(false);
    expect(sent).toEqual([]);
  });

  test('resolves native platform backends explicitly', () => {
    expect(resolveInputBackend({ platform: 'win32', env: {} })).toBe('windows');
    expect(resolveInputBackend({ platform: 'linux', env: {} })).toBe('linux');
    expect(resolveInputBackend({ platform: 'darwin', env: {} })).toBe('unsupported');
  });

  test('allows an explicit backend override', () => {
    expect(resolveInputBackend({
      platform: 'linux',
      env: { GYROCLOPTER_INPUT_BACKEND: 'none' }
    })).toBe('unsupported');

    expect(() => resolveInputBackend({
      platform: 'linux',
      env: { GYROCLOPTER_INPUT_BACKEND: 'banana' }
    })).toThrow('Unknown GYROCLOPTER_INPUT_BACKEND');
  });
});
