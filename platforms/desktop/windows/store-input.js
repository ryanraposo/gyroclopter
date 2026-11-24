const { spawn } = require('child_process');
const { createInterface } = require('readline');

class WindowsStoreInputController {
  constructor({ env = process.env, onError = () => {}, onAvailability = () => {} }) {
    this.name = 'windows-store';
    this.available = false;
    this.stopping = false;
    let reported = false;
    const helper = spawn(env.GYROCLOPTER_WINDOWS_HELPER, [], {
      stdio: ['pipe', 'pipe', 'pipe'],
      windowsHide: true
    });
    this.helper = helper;
    const fail = (message) => {
      if (this.stopping || reported) return;
      reported = true;
      this.available = false;
      onError({ code: 'WINDOWS_INPUT_ERROR', message });
    };

    createInterface({ input: helper.stdout }).on('line', (line) => {
      if (this.stopping || reported || line !== 'READY') return;
      this.available = true;
      onAvailability(true);
    });
    createInterface({ input: helper.stderr }).on('line', (line) => {
      console.error('Windows mouse helper:', line);
    });
    helper.on('error', (error) => fail(error.message));
    helper.stdin.on('error', (error) => fail(error.message));
    helper.on('close', (code) => fail(`Mouse helper stopped (${code}). Restart the server to retry.`));
  }

  sendCommand(command) {
    if (!this.available || !this.helper.stdin.writable) return;
    if (this.helper.stdin.writableNeedDrain && command.startsWith('MOVE ')) return;
    this.helper.stdin.write(command + '\n');
  }

  dispose() {
    this.stopping = true;
    this.available = false;
    if (this.helper.stdin.writable) this.helper.stdin.end();
  }
}

module.exports = WindowsStoreInputController;
