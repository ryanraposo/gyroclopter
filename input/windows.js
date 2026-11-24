const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawn } = require('child_process');

class WindowsInputController {
  constructor() {
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
      console.error('Failed to write Windows input script:', err);
      this.available = false;
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

    this.process.on('error', (err) => {
      console.error('Failed to start Windows input controller:', err);
      this.ready = false;
      this.available = false;
    });

    this.process.stderr.on('data', (chunk) => {
      const msg = chunk.toString();
      if (msg.startsWith('STARTUP_ERR')) {
        console.error('Windows input controller startup failed:', msg);
        this.ready = false;
        this.available = false;
      } else if (msg.startsWith('ERR ')) {
        console.error('Windows input controller command error:', msg);
      }
    });

    this.process.on('exit', () => {
      this.ready = false;
      this.process = null;
    });

    let stdoutBuffer = '';
    this.process.stdout.on('data', (chunk) => {
      stdoutBuffer += chunk.toString();
      let idx;
      while ((idx = stdoutBuffer.indexOf('\n')) !== -1) {
        const line = stdoutBuffer.slice(0, idx).trim();
        stdoutBuffer = stdoutBuffer.slice(idx + 1);
        if (line === 'READY') {
          this.ready = true;
          const pending = this.queue;
          this.queue = [];
          for (const cmd of pending) this.sendCommand(cmd);
        }
      }
    });
  }

  sendCommand(command) {
    if (!this.process || !this.process.stdin || !this.process.stdin.writable) return;
    if (!this.ready) {
      this.queue.push(command);
      if (this.queue.length > 256) this.queue.shift();
      return;
    }
    this.process.stdin.write(command + '\n');
  }

  dispose() {
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
