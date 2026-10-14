const { EventEmitter } = require('events');

jest.mock('child_process', () => ({ spawn: jest.fn() }));

const { spawn } = require('child_process');
const { MacMouseController, getHelperPath } = require('../app/macos-mouse-controller');

describe('Mac mouse controller', () => {
  let child;

  beforeEach(() => {
    child = new EventEmitter();
    child.stdout = new EventEmitter();
    child.stderr = new EventEmitter();
    child.stdin = { writable: true, write: jest.fn(), end: jest.fn() };
    child.kill = jest.fn();
    spawn.mockReturnValue(child);
  });

  afterEach(() => jest.clearAllMocks());

  test('starts the packaged helper protocol and flushes queued commands on READY', () => {
    const mouse = new MacMouseController();
    expect(spawn).toHaveBeenCalledWith(getHelperPath(), [], { stdio: ['pipe', 'pipe', 'pipe'] });
    mouse.sendCommand('MOVE 4 -2');
    expect(child.stdin.write).not.toHaveBeenCalled();
    child.stdout.emit('data', Buffer.from('RE'));
    child.stdout.emit('data', Buffer.from('ADY\n'));
    expect(child.stdin.write).toHaveBeenCalledWith('MOVE 4 -2\n');
    mouse.sendCommand('LEFT_DOWN');
    expect(child.stdin.write).toHaveBeenCalledWith('LEFT_DOWN\n');
    mouse.dispose();
    expect(child.stdin.end).toHaveBeenCalledWith('exit\n');
    expect(child.kill).toHaveBeenCalled();
  });

  test('reports macOS Accessibility denial to the server', () => {
    const onError = jest.fn();
    const mouse = new MacMouseController(onError);
    child.stderr.emit('data', Buffer.from('ACCESSIBILITY_REQUIRED: Allow Gyroclopter in Settings\n'));
    expect(onError).toHaveBeenCalledWith({
      code: 'ACCESSIBILITY_REQUIRED',
      message: 'Allow Gyroclopter in Settings'
    });
    mouse.dispose();
  });
});
