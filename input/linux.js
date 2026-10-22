const { exec } = require('child_process');

class LinuxInputController {
  constructor(options = {}) {
    const env = options.env || process.env;
    this.session = options.session || env.XDG_SESSION_TYPE || (env.DISPLAY ? 'x11' : 'unknown');
    this.name = `linux-${this.session}`;
    this.cmd = null;

    if (this.session === 'x11') {
      this.cmd = 'xdotool';
    } else if (this.session === 'wayland') {
      this.cmd = 'ydotool';
    } else {
      console.warn('LinuxInputController: unknown session type; input is unavailable');
    }

    this.available = Boolean(this.cmd);
  }

  sendCommand(command) {
    if (!this.cmd) return;
    const parts = command.split(' ');
    const type = parts[0];

    if (type === 'MOVE') {
      const dx = parts[1];
      const dy = parts[2];
      const shellCommand = this.cmd === 'xdotool'
        ? `xdotool mousemove_relative --sync ${dx} ${dy}`
        : `ydotool mousemove -r -- ${dx} ${dy}`;
      exec(shellCommand, (err) => { if (err) console.error('Mouse move error', err); });
    } else if (type === 'LEFT_DOWN') {
      exec(this.cmd === 'xdotool' ? 'xdotool mousedown 1' : 'ydotool click 0x40');
    } else if (type === 'LEFT_UP') {
      exec(this.cmd === 'xdotool' ? 'xdotool mouseup 1' : 'ydotool click 0x80');
    } else if (type === 'CLICK_RIGHT') {
      exec(this.cmd === 'xdotool' ? 'xdotool click 3' : 'ydotool click 0xC1');
    } else if (type === 'SCROLL') {
      const delta = parseInt(parts[1], 10);
      if (this.cmd === 'xdotool') {
        exec(delta > 0 ? 'xdotool click 4' : 'xdotool click 5');
      } else {
        const scrollY = delta > 0 ? -3 : 3;
        exec(`ydotool mousemove --wheel -x 0 -y ${scrollY}`);
      }
    }
  }

  dispose() {}
}

module.exports = LinuxInputController;
