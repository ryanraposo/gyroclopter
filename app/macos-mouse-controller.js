const path = require('path');
const { spawn } = require('child_process');

/** Resolves the native helper in development and in a packaged Mac app. */
function getHelperPath() {
  if (__dirname.includes('app.asar')) {
    return path.join(process.resourcesPath, 'native', 'gyroclopter-mouse');
  }
  return path.join(__dirname, '..', 'build', 'macos', 'gyroclopter-mouse');
}

/** Maintains a single native input process for all WebSocket commands. */
class MacMouseController {
  constructor(onError = () => {}) {
    this.onError = onError;
    this.ready = false;
    this.queue = [];
    this.process = spawn(getHelperPath(), [], { stdio: ['pipe', 'pipe', 'pipe'] });

    let stdout = '';
    this.process.stdout.on('data', (chunk) => {
      stdout += chunk.toString();
      let newline;
      while ((newline = stdout.indexOf('\n')) !== -1) {
        const line = stdout.slice(0, newline).trim();
        stdout = stdout.slice(newline + 1);
        if (line === 'READY') {
          this.ready = true;
          for (const command of this.queue) this.process.stdin.write(command + '\n');
          this.queue = [];
        }
      }
    });

    this.process.stderr.on('data', (chunk) => {
      const message = chunk.toString().trim();
      if (message.startsWith('ACCESSIBILITY_REQUIRED')) {
        this.onError({ code: 'ACCESSIBILITY_REQUIRED', message: message.split(': ').slice(1).join(': ') });
      } else if (message) {
        this.onError({ code: 'MAC_MOUSE_ERROR', message });
      }
    });
    this.process.on('error', (error) => {
      this.ready = false;
      this.onError({ code: 'MAC_MOUSE_ERROR', message: error.message });
    });
    this.process.on('exit', (code) => {
      this.ready = false;
      this.queue = [];
      if (code && code !== 2) {
        this.onError({ code: 'MAC_MOUSE_EXIT', message: `Mouse helper exited with code ${code}` });
      }
    });
  }

  /** Send a validated protocol command, buffering startup commands briefly. */
  sendCommand(command) {
    if (!this.process || !this.process.stdin.writable) return;
    if (this.ready) {
      this.process.stdin.write(command + '\n');
    } else {
      this.queue.push(command);
      if (this.queue.length > 256) this.queue.shift();
    }
  }

  /** Release the helper when the server stops. */
  dispose() {
    if (!this.process) return;
    if (this.process.stdin.writable) this.process.stdin.end('exit\n');
    this.process.kill();
    this.process = null;
    this.ready = false;
    this.queue = [];
  }
}

module.exports = { MacMouseController, getHelperPath };
