const manifest = chrome.runtime.getManifest();
const PRIVILEGED_BUILD = Array.isArray(manifest.permissions) && manifest.permissions.includes('debugger');
const SKUNK_BUILD = /skunk works/i.test(manifest.name || '');
const DEFAULT_RELAY = 'https://127.0.0.1:9443';

let ws = null;
let reconnectTimer = null;
let reconnectAttempt = 0;
let inputQueue = Promise.resolve();
let pairing = null;
let controllerConnected = false;
let armedTabId = null;
let fullMode = false;
let autoPilot = SKUNK_BUILD;
let debuggerAttachedTabId = null;
let lastError = null;

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function publicState() {
  return {
    privilegedBuild: PRIVILEGED_BUILD,
    relayUrl: pairing && pairing.relayUrl || DEFAULT_RELAY,
    paired: Boolean(pairing),
    socketConnected: Boolean(ws && ws.readyState === WebSocket.OPEN),
    controllerConnected,
    armed: armedTabId != null,
    armedTabId,
    fullMode: PRIVILEGED_BUILD && fullMode,
    skunkBuild: SKUNK_BUILD,
    autoPilot,
    controllerUrl: pairing && pairing.controllerUrl || null,
    qr: pairing && pairing.qr || null,
    expiresAt: pairing && pairing.expiresAt || null,
    error: lastError
  };
}

async function persistSession() {
  if (pairing) await chrome.storage.session.set({ webPilotPairing: pairing });
  else await chrome.storage.session.remove('webPilotPairing');
  if (SKUNK_BUILD) {
    if (pairing) await chrome.storage.local.set({ webPilotStickyPairing: pairing });
    else await chrome.storage.local.remove('webPilotStickyPairing');
  }
  await chrome.storage.local.set({
    webPilotSettings: {
      relayUrl: pairing && pairing.relayUrl || DEFAULT_RELAY,
      fullMode,
      autoPilot
    }
  });
}

function setError(error) {
  lastError = error ? String(error.message || error) : null;
}

function normalizeRelayUrl(value) {
  const url = new URL(String(value || DEFAULT_RELAY));
  if (!['http:', 'https:'].includes(url.protocol)) throw new Error('Relay must use http:// or https://');
  url.pathname = '';
  url.search = '';
  url.hash = '';
  return url.toString().replace(/\/$/, '');
}

function websocketUrl(relayUrl) {
  const url = new URL(relayUrl);
  url.protocol = url.protocol === 'https:' ? 'wss:' : 'ws:';
  url.pathname = '/ws';
  return url.toString();
}

function sanitizeInput(input) {
  if (!input || typeof input.type !== 'string') return null;
  if (input.type === 'move') {
    const dx = Number(input.dx);
    const dy = Number(input.dy);
    if (!Number.isFinite(dx) || !Number.isFinite(dy)) return null;
    return { type: 'move', dx: clamp(dx, -120, 120), dy: clamp(dy, -120, 120) };
  }
  if (input.type === 'scroll') {
    const delta = Number(input.delta);
    if (!Number.isFinite(delta)) return null;
    return { type: 'scroll', delta: clamp(delta, -600, 600) };
  }
  if (['down', 'up', 'right'].includes(input.type)) return { type: input.type };
  return null;
}

async function createPairing(relayValue) {
  const relayUrl = normalizeRelayUrl(relayValue);
  setError(null);
  const response = await fetch(`${relayUrl}/api/session`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: '{}',
    cache: 'no-store'
  });
  if (!response.ok) throw new Error(`Relay returned ${response.status}`);
  const data = await response.json();
  if (!data.room || !data.key || !data.controllerUrl) throw new Error('Relay returned an invalid pairing session');
  pairing = {
    relayUrl,
    room: data.room,
    key: data.key,
    controllerUrl: data.controllerUrl,
    qr: data.qr || null,
    expiresAt: data.expiresAt || null
  };
  controllerConnected = false;
  await persistSession();
  connectSocket();
  return publicState();
}

function clearReconnect() {
  if (reconnectTimer) clearTimeout(reconnectTimer);
  reconnectTimer = null;
}

function scheduleReconnect() {
  if (!pairing || reconnectTimer) return;
  const delay = Math.min(5000, 500 * Math.pow(2, reconnectAttempt++));
  reconnectTimer = setTimeout(() => {
    reconnectTimer = null;
    connectSocket();
  }, delay);
}

function connectSocket() {
  clearReconnect();
  if (!pairing) return;
  if (pairing.expiresAt && Date.now() > new Date(pairing.expiresAt).getTime()) {
    forgetPairing();
    return;
  }
  if (ws) {
    try { ws.close(); } catch (_) {}
    ws = null;
  }

  try {
    ws = new WebSocket(websocketUrl(pairing.relayUrl));
  } catch (error) {
    setError(error);
    scheduleReconnect();
    return;
  }

  ws.onopen = () => {
    reconnectAttempt = 0;
    setError(null);
    ws.send(JSON.stringify({ type: 'hello', role: 'pilot', room: pairing.room, key: pairing.key }));
  };

  ws.onmessage = (event) => {
    let message;
    try { message = JSON.parse(event.data); } catch (_) { return; }
    if (message.type === 'input') {
      const input = sanitizeInput(message.input);
      if (!input || armedTabId == null) return;
      inputQueue = inputQueue.then(() => routeInput(input)).catch((error) => {
        setError(error);
        return disarm('input-error');
      });
      return;
    }
    if (message.type === 'peer' && message.role === 'controller') {
      controllerConnected = Boolean(message.connected);
      if (controllerConnected && SKUNK_BUILD && autoPilot) {
        armActiveTab().catch(setError);
      }
      return;
    }
    if (message.type === 'error') setError(message.message || 'Relay error');
  };

  ws.onclose = () => {
    ws = null;
    controllerConnected = false;
    scheduleReconnect();
  };

  ws.onerror = () => setError('Could not connect to relay. Trust the local certificate, then retry.');
}

function sendRelay(message) {
  if (!ws || ws.readyState !== WebSocket.OPEN) return;
  try { ws.send(JSON.stringify(message)); } catch (_) {}
}

setInterval(() => {
  if (ws && ws.readyState === WebSocket.OPEN) sendRelay({ type: 'ping', at: Date.now() });
}, 20000);

async function attachDebugger(tabId) {
  if (!PRIVILEGED_BUILD || !fullMode) return;
  if (debuggerAttachedTabId === tabId) return;
  if (debuggerAttachedTabId != null) await detachDebugger();
  await chrome.debugger.attach({ tabId }, '1.3');
  debuggerAttachedTabId = tabId;
}

async function detachDebugger() {
  if (debuggerAttachedTabId == null || !PRIVILEGED_BUILD) return;
  const tabId = debuggerAttachedTabId;
  debuggerAttachedTabId = null;
  try { await chrome.debugger.detach({ tabId }); } catch (_) {}
}

async function dispatchCdp(input, pointer) {
  if (!PRIVILEGED_BUILD || !fullMode || debuggerAttachedTabId == null || !pointer) return;
  const target = { tabId: debuggerAttachedTabId };
  const common = { x: pointer.x, y: pointer.y };
  if (input.type === 'move') {
    await chrome.debugger.sendCommand(target, 'Input.dispatchMouseEvent', Object.assign({
      type: 'mouseMoved', buttons: pointer.buttons || 0
    }, common));
    return;
  }
  if (input.type === 'down') {
    await chrome.debugger.sendCommand(target, 'Input.dispatchMouseEvent', Object.assign({
      type: 'mousePressed', button: 'left', buttons: 1, clickCount: 1
    }, common));
    return;
  }
  if (input.type === 'up') {
    await chrome.debugger.sendCommand(target, 'Input.dispatchMouseEvent', Object.assign({
      type: 'mouseReleased', button: 'left', buttons: 0, clickCount: 1
    }, common));
    return;
  }
  if (input.type === 'right') {
    await chrome.debugger.sendCommand(target, 'Input.dispatchMouseEvent', Object.assign({
      type: 'mousePressed', button: 'right', buttons: 2, clickCount: 1
    }, common));
    await chrome.debugger.sendCommand(target, 'Input.dispatchMouseEvent', Object.assign({
      type: 'mouseReleased', button: 'right', buttons: 0, clickCount: 1
    }, common));
    return;
  }
  if (input.type === 'scroll') {
    await chrome.debugger.sendCommand(target, 'Input.dispatchMouseEvent', Object.assign({
      type: 'mouseWheel', deltaX: 0, deltaY: -input.delta, buttons: pointer.buttons || 0
    }, common));
  }
}

async function routeInput(input) {
  if (armedTabId == null) return;
  let pointer;
  try {
    pointer = await chrome.tabs.sendMessage(armedTabId, { type: 'GYRO_INPUT', input });
  } catch (error) {
    throw new Error(`Controlled page is no longer available: ${error.message || error}`);
  }
  if (fullMode) await dispatchCdp(input, pointer);
}

async function armActiveTab() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab || tab.id == null) {
    if (armedTabId != null) await disarm('no-active-tab');
    throw new Error('No active tab');
  }
  if (!/^https?:/i.test(tab.url || '')) {
    if (armedTabId != null) await disarm('restricted-tab');
    throw new Error('Web Pilot can only arm normal http(s) pages');
  }
  if (armedTabId != null && armedTabId !== tab.id) await disarm('switch');

  await chrome.scripting.insertCSS({ target: { tabId: tab.id }, files: ['content.css'] }).catch(() => {});
  await chrome.scripting.executeScript({ target: { tabId: tab.id }, files: ['interaction-field.js'] });
  await chrome.scripting.executeScript({ target: { tabId: tab.id }, files: ['content.js'] });
  if (PRIVILEGED_BUILD && fullMode) await attachDebugger(tab.id);
  await chrome.tabs.sendMessage(tab.id, { type: 'GYRO_ARM', fullMode: PRIVILEGED_BUILD && fullMode });
  armedTabId = tab.id;
  setError(null);
  sendRelay({ type: 'pilot-status', armed: true, fullMode: PRIVILEGED_BUILD && fullMode });
  return publicState();
}

async function disarm(reason = 'manual') {
  const tabId = armedTabId;
  armedTabId = null;
  if (tabId != null) {
    try { await chrome.tabs.sendMessage(tabId, { type: 'GYRO_DISARM' }); } catch (_) {}
  }
  await detachDebugger();
  sendRelay({ type: 'pilot-status', armed: false, reason });
  return publicState();
}

async function forgetPairing() {
  await disarm('unpaired');
  clearReconnect();
  if (ws) {
    try { ws.close(); } catch (_) {}
    ws = null;
  }
  pairing = null;
  controllerConnected = false;
  await persistSession();
  return publicState();
}

async function setFullMode(value) {
  const wanted = Boolean(value) && PRIVILEGED_BUILD;
  if (armedTabId != null && wanted !== fullMode) await disarm('mode-change');
  fullMode = wanted;
  await persistSession();
  if (SKUNK_BUILD && autoPilot && controllerConnected) await armActiveTab().catch(setError);
  return publicState();
}

async function setAutoPilot(value) {
  autoPilot = SKUNK_BUILD ? Boolean(value) : false;
  await persistSession();
  if (!autoPilot) return disarm('auto-pilot-off');
  if (controllerConnected) await armActiveTab().catch(setError);
  return publicState();
}

async function restore() {
  const [session, local] = await Promise.all([
    chrome.storage.session.get('webPilotPairing'),
    chrome.storage.local.get(['webPilotSettings', 'webPilotStickyPairing'])
  ]);
  const settings = local.webPilotSettings || {};
  pairing = session.webPilotPairing || (SKUNK_BUILD ? local.webPilotStickyPairing : null) || null;
  fullMode = PRIVILEGED_BUILD && Boolean(settings.fullMode);
  autoPilot = SKUNK_BUILD && settings.autoPilot !== false;
  if (pairing) connectSocket();
}

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  (async () => {
    if (!message || typeof message.type !== 'string') return publicState();
    if (message.type === 'GET_STATE') return publicState();
    if (message.type === 'PAIR') return createPairing(message.relayUrl);
    if (message.type === 'RECONNECT') { connectSocket(); return publicState(); }
    if (message.type === 'ARM') return armActiveTab();
    if (message.type === 'DISARM') return disarm('manual');
    if (message.type === 'FORGET_PAIRING') return forgetPairing();
    if (message.type === 'SET_FULL_MODE') return setFullMode(message.value);
    if (message.type === 'SET_AUTO_PILOT') return setAutoPilot(message.value);
    if (message.type === 'GYRO_ESCAPE_DISARM') return disarm('escape');
    if (message.type === 'RESET_PROFILE') {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (!tab || tab.id == null || !/^https?:/i.test(tab.url || '')) throw new Error('Open a normal web page first');
      await chrome.scripting.executeScript({ target: { tabId: tab.id }, files: ['interaction-field.js'] });
      await chrome.scripting.executeScript({ target: { tabId: tab.id }, files: ['content.js'] });
      await chrome.tabs.sendMessage(tab.id, { type: 'GYRO_RESET_PROFILE' });
      return publicState();
    }
    return publicState();
  })().then(sendResponse).catch((error) => {
    setError(error);
    sendResponse(Object.assign(publicState(), { error: String(error.message || error) }));
  });
  return true;
});


chrome.tabs.onActivated.addListener((info) => {
  if (SKUNK_BUILD && autoPilot && controllerConnected) {
    armActiveTab().catch(setError);
  } else if (armedTabId != null && info.tabId !== armedTabId) {
    disarm('tab-change');
  }
});

chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (armedTabId === tabId && changeInfo.status === 'loading') disarm('navigation');
  if (SKUNK_BUILD && autoPilot && controllerConnected && changeInfo.status === 'complete' && tab && tab.active) {
    armActiveTab().catch(setError);
  }
});

chrome.tabs.onRemoved.addListener((tabId) => {
  if (armedTabId === tabId) disarm('tab-closed');
});

if (PRIVILEGED_BUILD && chrome.debugger && chrome.debugger.onDetach) {
  chrome.debugger.onDetach.addListener((source) => {
    if (source.tabId === debuggerAttachedTabId) {
      debuggerAttachedTabId = null;
      if (armedTabId === source.tabId && fullMode) disarm('debugger-detached');
    }
  });
}

chrome.runtime.onStartup.addListener(() => restore());
chrome.runtime.onInstalled.addListener(() => restore());
restore();
