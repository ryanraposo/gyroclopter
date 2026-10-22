const BRIDGE_URL = 'ws://localhost:8444';
const RECONNECT_MS = 1500;
const KEEPALIVE_MS = 20000;
const HOVER_INTERVAL_MS = 40;

let socket = null;
let desktopRoot = null;
let automationReady = false;
let reconnectTimer = null;
let keepAliveTimer = null;
let hoverTimer = null;
let pressedNode = null;
let lastHoveredNode = null;
let cursor = { x: 0, y: 0 };

function setBadge(text) {
  try { chrome.action.setBadgeText({ text }); } catch (_) {}
}

function desktopBounds() {
  const location = desktopRoot && desktopRoot.location;
  if (!location) return { left: 0, top: 0, width: 1920, height: 1080 };
  return {
    left: location.left || 0,
    top: location.top || 0,
    width: Math.max(1, location.width || 1920),
    height: Math.max(1, location.height || 1080)
  };
}

function resetCursor() {
  const bounds = desktopBounds();
  cursor.x = bounds.left + Math.floor(bounds.width / 2);
  cursor.y = bounds.top + Math.floor(bounds.height / 2);
}

function ensureDesktop(callback = () => {}) {
  if (desktopRoot) {
    callback(desktopRoot);
    return;
  }
  if (!chrome.automation || typeof chrome.automation.getDesktop !== 'function') {
    automationReady = false;
    callback(null);
    return;
  }

  chrome.automation.getDesktop((root) => {
    if (chrome.runtime.lastError || !root) {
      automationReady = false;
      console.error('Gyroclopter: unable to access ChromeOS desktop Automation tree',
        chrome.runtime.lastError && chrome.runtime.lastError.message);
      callback(null);
      return;
    }
    desktopRoot = root;
    automationReady = true;
    resetCursor();
    callback(root);
  });
}

function hitTest(callback) {
  ensureDesktop((root) => {
    if (!root) return callback(null);
    try {
      root.hitTestWithReply(Math.round(cursor.x), Math.round(cursor.y), (node) => callback(node || null));
    } catch (err) {
      console.error('Gyroclopter hit-test failed', err);
      callback(null);
    }
  });
}

function focusNode(node) {
  if (!node || node === lastHoveredNode) return;
  lastHoveredNode = node;
  try { node.focus(); } catch (_) {}
}

function scheduleHover() {
  if (hoverTimer) return;
  hoverTimer = setTimeout(() => {
    hoverTimer = null;
    hitTest(focusNode);
  }, HOVER_INTERVAL_MS);
}

function clampCursor() {
  const bounds = desktopBounds();
  cursor.x = Math.max(bounds.left, Math.min(bounds.left + bounds.width - 1, cursor.x));
  cursor.y = Math.max(bounds.top, Math.min(bounds.top + bounds.height - 1, cursor.y));
}

function findScrollable(node) {
  let current = node;
  while (current) {
    if (current.scrollable ||
        (Number.isFinite(current.scrollYMin) &&
         Number.isFinite(current.scrollYMax) &&
         current.scrollYMax > current.scrollYMin)) return current;
    current = current.parent;
  }
  return null;
}

function activateAtCursor() {
  hitTest((node) => {
    const target = node || pressedNode;
    pressedNode = null;
    if (!target) return;
    try { target.doDefault(); } catch (err) { console.warn('Gyroclopter default action failed', err); }
  });
}

function scrollAtCursor(delta) {
  hitTest((node) => {
    const target = findScrollable(node);
    if (!target) return;
    try {
      if (delta > 0) target.scrollUp(() => {});
      else target.scrollDown(() => {});
    } catch (err) {
      console.warn('Gyroclopter scroll action failed', err);
    }
  });
}

function handleCommand(command) {
  const parts = String(command || '').trim().split(/\s+/);
  const type = parts[0];

  if (type === 'MOVE') {
    const dx = Number(parts[1]);
    const dy = Number(parts[2]);
    if (!Number.isFinite(dx) || !Number.isFinite(dy)) return;
    cursor.x += dx;
    cursor.y += dy;
    clampCursor();
    scheduleHover();
    return;
  }
  if (type === 'LEFT_DOWN') {
    hitTest((node) => { pressedNode = node; focusNode(node); });
    return;
  }
  if (type === 'LEFT_UP') return activateAtCursor();
  if (type === 'CLICK_RIGHT') {
    hitTest((node) => {
      if (!node) return;
      try { node.showContextMenu(); } catch (err) { console.warn('Gyroclopter context menu action failed', err); }
    });
    return;
  }
  if (type === 'SCROLL') {
    const delta = Number(parts[1]);
    if (Number.isFinite(delta) && delta !== 0) scrollAtCursor(delta);
  }
}

function stopKeepAlive() {
  if (keepAliveTimer) clearInterval(keepAliveTimer);
  keepAliveTimer = null;
}

function startKeepAlive() {
  stopKeepAlive();
  keepAliveTimer = setInterval(() => {
    if (socket && socket.readyState === WebSocket.OPEN) socket.send(JSON.stringify({ type: 'ping' }));
  }, KEEPALIVE_MS);
}

function scheduleReconnect() {
  if (reconnectTimer) return;
  reconnectTimer = setTimeout(() => {
    reconnectTimer = null;
    connect();
  }, RECONNECT_MS);
}

async function sendReady() {
  if (!socket || socket.readyState !== WebSocket.OPEN) return;
  const stored = await chrome.storage.local.get(['hostIp']);
  socket.send(JSON.stringify({
    type: 'hello',
    client: 'gyroclopter-chromeos',
    protocol: 1,
    bounds: desktopBounds(),
    automationReady,
    hostIp: stored.hostIp || null
  }));
}

function connect() {
  if (socket && (socket.readyState === WebSocket.OPEN || socket.readyState === WebSocket.CONNECTING)) return;

  try {
    socket = new WebSocket(BRIDGE_URL);
  } catch (err) {
    console.error('Gyroclopter bridge connection failed', err);
    scheduleReconnect();
    return;
  }

  socket.onopen = () => {
    setBadge('ON');
    startKeepAlive();
    ensureDesktop(() => sendReady());
  };

  socket.onmessage = (event) => {
    let message;
    try { message = JSON.parse(event.data); } catch (_) { return; }
    if (message.type === 'input') handleCommand(message.command);
    else if (message.type === 'hello') ensureDesktop(() => sendReady());
  };

  socket.onerror = () => { try { socket.close(); } catch (_) {} };
  socket.onclose = () => {
    socket = null;
    setBadge('OFF');
    stopKeepAlive();
    scheduleReconnect();
  };
}

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (!message || typeof message.type !== 'string') return false;
  if (message.type === 'status') {
    sendResponse({
      connected: Boolean(socket && socket.readyState === WebSocket.OPEN),
      automationReady
    });
    return false;
  }
  if (message.type === 'host-ip-updated') {
    sendReady().finally(() => sendResponse({ ok: true }));
    return true;
  }
  return false;
});

chrome.action.onClicked.addListener(() => chrome.tabs.create({ url: chrome.runtime.getURL('setup.html') }));
chrome.runtime.onInstalled.addListener(() => {
  chrome.tabs.create({ url: chrome.runtime.getURL('setup.html') });
  connect();
  ensureDesktop();
});
chrome.runtime.onStartup.addListener(() => { connect(); ensureDesktop(); });

connect();
ensureDesktop();
