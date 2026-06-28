const STATE = {
  serverPid: null,
  running: false,
  connectedCount: 0,
  extractedServerPath: null
};

const els = {
  qrCanvas: document.getElementById('qr-canvas'),
  qrPlaceholder: document.getElementById('qr-placeholder'),
  urlDisplay: document.getElementById('url-display'),
  statusDot: document.getElementById('status-dot'),
  statusText: document.getElementById('status-text'),
  connectedCount: document.getElementById('connected-count'),
  btnToggle: document.getElementById('btn-toggle')
};

function setStatus(running) {
  STATE.running = running;
  els.statusDot.className = 'status-dot ' + (running ? 'running' : 'stopped');
  els.statusText.textContent = running ? 'Running' : 'Stopped';
  els.btnToggle.textContent = running ? 'Stop Server' : 'Start Server';
  els.btnToggle.className = 'btn ' + (running ? 'btn-stop' : 'btn-start');
  if (!running) {
    els.qrCanvas.innerHTML = '<span id="qr-placeholder">Start the server to see the pairing QR code</span>';
    els.urlDisplay.textContent = '';
    els.connectedCount.textContent = '';
    STATE.connectedCount = 0;
  }
  refreshTrayMenu().catch(() => {});
}

function setConnectedCount(count) {
  STATE.connectedCount = count;
  els.connectedCount.textContent = count > 0 ? count + ' device' + (count !== 1 ? 's' : '') + ' connected' : '';
}

function showQR(url, qrDataUrl) {
  els.urlDisplay.textContent = url;
  if (qrDataUrl) {
    els.qrCanvas.innerHTML = '<img src="' + qrDataUrl + '" alt="QR Code">';
  } else {
    els.qrCanvas.innerHTML = '<span id="qr-placeholder">' + url + '</span>';
  }
}

/**
 * Resolves the absolute path to the server binary on disk.
 *
 * In dev/dir mode (`NL_RESMODE === 'directory'`), the resources directory
 * is on disk at `<NL_PATH>/resources/`, so we can spawn it directly.
 *
 * In bundle/embedded mode, resources are inside the binary and must first
 * be extracted to a writable temp directory via the Neutralino resources
 * API. We cache the extracted path on `STATE.extractedServerPath` and
 * re-extract on every start so updates to resources.neu are picked up.
 */
async function getServerPath() {
  const resMode = (window.NL_RESMODE || 'directory');
  if (resMode === 'directory') {
    return (window.NL_PATH || '.') + '/resources/gyroclopter-server.exe';
  }

  // Embedded or bundle mode — extract the binary to a temp directory.
  // Use a per-app temp subdir so it doesn't collide with Neutralino's own
  // `.tmp/auth_info.json` location.
  const tmpRoot = (window.NL_DATAPATH || window.NL_PATH || '.') + '/.tmp/gyroclopter-server';
  await Neutralino.filesystem.createDirectory(tmpRoot).catch(() => {});
  const dest = tmpRoot + '/gyroclopter-server.exe';

  // Always re-extract so a rebuilt server binary is picked up after updates.
  await Neutralino.resources.extractFile('/resources/gyroclopter-server.exe', dest);
  STATE.extractedServerPath = dest;
  return dest;
}

async function startServer() {
  els.btnToggle.disabled = true;
  try {
    const serverPath = await getServerPath();
    const info = await Neutralino.os.spawnProcess(serverPath);
    STATE.serverPid = info.pid;
  } catch (err) {
    console.error('Failed to start server', err);
    els.statusText.textContent = 'Failed to start server';
    setStatus(false);
  }
}

function stopServer() {
  if (STATE.serverPid) {
    try {
      Neutralino.os.updateSpawnedProcess(STATE.serverPid, 'kill');
    } catch (err) {
      console.error('Failed to stop server', err);
    }
    STATE.serverPid = null;
  }
  setStatus(false);
}

els.btnToggle.onclick = () => {
  if (STATE.running) {
    stopServer();
  } else {
    startServer();
  }
};

Neutralino.events.on('spawnedProcess', (evt) => {
  const detail = evt.detail;
  if (detail.action === 'stdOut' || detail.action === 'stdErr') {
    const lines = (detail.data || '').split('\n').filter(Boolean);
    for (const line of lines) {
      try {
        const msg = JSON.parse(line);
        switch (msg.event) {
          case 'started': {
            const url = 'https://' + msg.ip + ':' + msg.port;
            showQR(url, msg.qr || '');
            setStatus(true);
            break;
          }
          case 'connection':
          case 'disconnection':
            setConnectedCount(msg.count);
            break;
        }
      } catch (_) {
        /* ignore non-JSON lines */
      }
    }
  }
  if (detail.action === 'exit' || detail.action === 'error') {
    if (STATE.serverPid === detail.pid) {
      STATE.serverPid = null;
      setStatus(false);
    }
  }
  els.btnToggle.disabled = false;
});

// Close → minimize to tray. Quit is handled via the tray "Quit" item
// (or the OS-level "Quit" command), both of which call Neutralino.app.exit.
Neutralino.events.on('windowClose', () => {
  Neutralino.window.hide().catch((err) => {
    console.error('Failed to hide window', err);
    // If hiding fails (e.g. tray missing), fall back to a real exit so the
    // user is never trapped with no way to close the app.
    Neutralino.app.exit(0).catch(() => {});
  });
});

async function refreshTrayMenu() {
  try {
    await Neutralino.tray.setTray({
      icon: '/resources/icons/trayIcon.png',
      menuItems: [
        { id: 'show', text: 'Show Window' },
        { id: 'toggleServer', text: STATE.running ? 'Stop Server' : 'Start Server' },
        { id: 'quit', text: 'Quit' }
      ]
    });
  } catch (err) {
    console.error('Failed to refresh tray menu', err);
  }
}

async function setupTray() {
  await refreshTrayMenu();
}

Neutralino.events.on('trayMenuItemClicked', (evt) => {
  switch (evt.detail.id) {
    case 'show':
      Neutralino.window.show().catch(() => {});
      break;
    case 'toggleServer':
      if (STATE.running) {
        stopServer();
      } else {
        startServer();
      }
      break;
    case 'quit':
      if (STATE.running) stopServer();
      Neutralino.app.exit(0).catch(() => {});
      break;
  }
});

Neutralino.events.on('ready', () => {
  setupTray();
  // Auto-start the server on launch so the user can pair immediately.
  // The Start/Stop button (and tray menu) remain available to toggle it off.
  startServer();
});