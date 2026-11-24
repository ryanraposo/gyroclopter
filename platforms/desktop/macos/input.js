const path = require('path');
const { spawn } = require('child_process');
const { createInterface } = require('readline');

/** Resolve the executable outside app.asar, where macOS can launch it directly. */
function getHelperPath() {
  if (__dirname.includes('app.asar')) {
    return path.join(process.resourcesPath, 'native', 'gyroclopter-mouse');
  }
  return path.join(__dirname, '..', '..', '..', 'build', 'macos', 'gyroclopter-mouse');
}

class MacMouseController {
  constructor({ onError = () => {}, onAvailability = () => {} } = {}) {
    this.name = 'macos';
    this.available = false;
    this.stopping = false;
    this.failureReported = false;
    const helper = spawn(getHelperPath(), [], { stdio: ['pipe', 'pipe', 'pipe'] });
    this.helper = helper;

    const fail = (code, message) => {
      if (this.stopping || this.failureReported) return;
      this.failureReported = true;
      this.available = false;
      onError({ code, message });
    };

    createInterface({ input: helper.stdout }).on('line', (line) => {
      if (line !== 'READY' || this.stopping || this.failureReported) return;
      this.available = true;
      onAvailability(true);
    });
    createInterface({ input: helper.stderr }).on('line', (line) => {
      const prefix = 'ACCESSIBILITY_REQUIRED: ';
      if (line.startsWith(prefix)) {
        fail('ACCESSIBILITY_REQUIRED', line.slice(prefix.length));
      } else if (line) {
        console.error('macOS mouse helper:', line);
      }
    });
    helper.on('error', (error) => fail('MAC_MOUSE_ERROR', error.message));
    helper.stdin.on('error', (error) => fail('MAC_MOUSE_ERROR', error.message));
    helper.on('close', (code, signal) => {
      this.helper = null;
      fail('MAC_MOUSE_EXIT', `Mouse helper stopped (${signal || code}). Restart the server to retry.`);
    });
  }

  sendCommand(command) {
    if (!this.available || !this.helper?.stdin.writable) return;
    // Drop stale movement under backpressure and always send button releases.
    if (this.helper.stdin.writableNeedDrain && command.startsWith('MOVE ')) return;
    this.helper.stdin.write(command + '\n');
  }

  dispose() {
    this.stopping = true;
    this.available = false;
    // EOF lets the helper release a held left button before it exits.
    if (this.helper?.stdin.writable) this.helper.stdin.end();
  }
}

module.exports = { MacMouseController, getHelperPath };
