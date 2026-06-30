// app/main.js - Desktop UI controller
const STATE = {
  serverPid: null,
  running: false,
  connectedCount: 0
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

function startServer() {
  window.electronAPI?.startServer?.();
}

function stopServer() {
  window.electronAPI?.stopServer?.();
}

els.btnToggle.onclick = () => {
  if (STATE.running) {
    stopServer();
  } else {
    startServer();
  }
};

// Listen for server events from the Electron main process
window.electronAPI?.onServerEvent?.((msg) => {
  if (!msg || typeof msg !== 'object') return;
  switch (msg.event) {
    case 'started':
      const url = 'https://' + msg.ip + ':' + msg.port;
      showQR(url, msg.qr || '');
      setStatus(true);
      break;
    case 'connection':
    case 'disconnection':
      setConnectedCount(msg.count);
      break;
    case 'stopped':
      setStatus(false);
      break;
  }
});

window.electronAPI?.onServerExit?.(() => {
  setStatus(false);
});