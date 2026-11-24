const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawn } = require('child_process');

class WindowsInputController {
  constructor({ onError = () => {}, onAvailability = () => {} } = {}) {
    this.onError = onError;
    this.onAvailability = onAvailability;
    this.name = 'windows';
    this.available = true;
    this.process = null;
    this.ready = false;
    this.queue = [];
    this.scriptPath = null;
    this.init();
  }

  buildScript() {
    return [
      '$ErrorActionPreference = \'Stop\'',
      'try {',
      '  Add-Type -Namespace Gyroclopter -Name WinMouse -MemberDefinition @\'',
      '[DllImport("user32.dll")]',
      'public static extern void mouse_event(int dwFlags, int dx, int dy, int dwData, int dwExtraInfo);',
      '\'@',
      '  [Console]::Out.WriteLine("READY")',
      '  [Console]::Out.Flush()',
      '  while ($true) {',
      '    $line = [Console]::In.ReadLine()',
      '    if ($null -eq $line) { break }',
      '    if ($line -eq \'exit\') { break }',
      '    try {',
      '      $parts = $line -split \' \'',
      '      switch ($parts[0]) {',
      '        \'MOVE\'        { [Gyroclopter.WinMouse]::mouse_event(0x0001, [int]$parts[1], [int]$parts[2], 0, 0) }',
      '        \'LEFT_DOWN\'   { [Gyroclopter.WinMouse]::mouse_event(0x0002, 0, 0, 0, 0) }',
      '        \'LEFT_UP\'     { [Gyroclopter.WinMouse]::mouse_event(0x0004, 0, 0, 0, 0) }',
      '        \'CLICK_RIGHT\' { [Gyroclopter.WinMouse]::mouse_event(0x0008 -bor 0x0010, 0, 0, 0, 0) }',
      '        \'SCROLL\'      { [Gyroclopter.WinMouse]::mouse_event(0x0800, 0, 0, [int]$parts[1], 0) }',
      '      }',
      '    } catch {',
      '      [Console]::Error.WriteLine(("ERR " + $_.Exception.Message))',
      '    }',
      '  }',
      '} catch {',
      '  [Console]::Error.WriteLine(("STARTUP_ERR " + $_.Exception.Message))',
      '  exit 1',
      '}',
      ''
    ].join('\r\n');
  }

  init() {
    try {
      this.scriptPath = path.join(os.tmpdir(), `gyroclopter-mouse-${process.pid}.ps1`);
      fs.writeFileSync(this.scriptPath, this.buildScript(), 'utf8');
    } catch (err) {
      this.fail(err.message);
      return;
    }

    this.process = spawn('powershell.exe', [
      '-NoProfile',
      '-ExecutionPolicy', 'Bypass',
      '-File', this.scriptPath
    ], {
      stdio: ['pipe', 'pipe', 'pipe'],
      windowsHide: true
    });

    this.process.on('error', (err) => this.fail(err.message));
    this.process.stdin.on('error', (err) => this.fail(err.message));

    this.process.stderr.on('data', (chunk) => {
      const msg = chunk.toString();
      if (msg.startsWith('STARTUP_ERR')) {
        this.fail(msg.slice('STARTUP_ERR '.length).trim());
      } else if (msg.startsWith('ERR ')) {
        console.error('Windows input controller command error:', msg);
      }
    });

    this.process.on('close', (code) => {
      if (this.process) this.fail(`Mouse helper stopped (${code}). Restart the server to retry.`);
      this.process = null;
    });

    let stdoutBuffer = '';
    this.process.stdout.on('data', (chunk) => {
      stdoutBuffer += chunk.toString();
      let idx;
      while ((idx = stdoutBuffer.indexOf('\n')) !== -1) {
        const line = stdoutBuffer.slice(0, idx).trim();
        stdoutBuffer = stdoutBuffer.slice(idx + 1);
        if (line === 'READY' && this.available && this.process) {
          this.ready = true;
          this.onAvailability(true);
          const pending = this.queue;
          this.queue = [];
          for (const cmd of pending) this.sendCommand(cmd);
        }
      }
    });
  }

  fail(message) {
    if (!this.available) return;
    this.ready = false;
    this.available = false;
    this.queue = [];
    this.onError({ code: 'WINDOWS_INPUT_ERROR', message });
  }

  sendCommand(command) {
    if (!this.available || !this.process || !this.process.stdin || !this.process.stdin.writable) return;
    if (!this.ready) {
      this.queue.push(command);
      if (this.queue.length > 256) this.queue.shift();
      return;
    }
    this.process.stdin.write(command + '\n');
  }

  dispose() {
    this.available = false;
    if (this.process) {
      try {
        if (this.process.stdin && this.process.stdin.writable) this.process.stdin.write('exit\n');
      } catch (_) {}
      try { this.process.kill(); } catch (_) {}
      this.process = null;
    }
    if (this.scriptPath) {
      try { fs.unlinkSync(this.scriptPath); } catch (_) {}
      this.scriptPath = null;
    }
    this.ready = false;
    this.queue = [];
  }
}

module.exports = WindowsInputController;
