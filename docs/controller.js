(() => {
  const params = new URLSearchParams(location.hash.replace(/^#/, ''));
  const relay = params.get('relay');
  const room = params.get('room');
  const key = params.get('key');
  const $ = (id) => document.getElementById(id);
  const els = {
    relayDot: $('relay-dot'), relayStatus: $('relay-status'), pilotDot: $('pilot-dot'), pilotStatus: $('pilot-status'),
    sensitivity: $('sensitivity'), sensitivityValue: $('sensitivity-value'), motionPad: $('motion-pad'), motionLabel: $('motion-label'),
    left: $('left'), right: $('right'), scroll: $('scroll'), pause: $('pause'), gate: $('gate'), start: $('start'), gateNote: $('gate-note')
  };
  const state = { ws: null, connected: false, pilot: false, armed: false, active: true, permission: false, sensitivity: 10, wakeLock: null };

  if (!relay || !room || !key) {
    els.gateNote.textContent = 'Waiting for a Skunk Works pairing. Create one from the Web Pilot extension, then open its QR link here.';
    els.start.disabled = true;
  }

  function setDot(el, good) { el.classList.toggle('good', Boolean(good)); }
  function updateUi() {
    setDot(els.relayDot, state.connected);
    setDot(els.pilotDot, state.pilot);
    els.relayStatus.textContent = state.connected ? 'Relay connected' : 'Relay disconnected';
    els.pilotStatus.textContent = state.pilot ? (state.armed ? 'Browser armed' : 'Browser connected') : 'Waiting for browser';
    els.motionPad.classList.toggle('active', state.active);
    els.motionLabel.textContent = state.active ? 'ACTIVE' : 'PAUSED';
    els.pause.textContent = state.active ? 'PAUSE' : 'RESUME';
  }

  function wsUrl() {
    const url = new URL(relay);
    url.protocol = url.protocol === 'https:' ? 'wss:' : 'ws:';
    url.pathname = '/ws';
    url.search = '';
    url.hash = '';
    return url.toString();
  }

  function connect() {
    if (!relay || !room || !key) return;
    if (state.ws) try { state.ws.close(); } catch (_) {}
    const ws = new WebSocket(wsUrl());
    state.ws = ws;
    ws.onopen = () => {
      state.connected = true;
      ws.send(JSON.stringify({ type: 'hello', role: 'controller', room, key }));
      updateUi();
    };
    ws.onmessage = (event) => {
      let message;
      try { message = JSON.parse(event.data); } catch (_) { return; }
      if (message.type === 'peer' && message.role === 'pilot') state.pilot = Boolean(message.connected);
      if (message.type === 'pilot-status') state.armed = Boolean(message.armed);
      if (message.type === 'error') els.gateNote.textContent = message.message || 'Pairing error';
      updateUi();
    };
    ws.onclose = () => {
      state.connected = false;
      state.pilot = false;
      state.armed = false;
      updateUi();
      setTimeout(connect, 1200);
    };
    ws.onerror = () => { els.gateNote.textContent = 'Relay connection failed. The pairing may have expired.'; };
  }

  function send(input) {
    if (!state.connected || !state.ws || state.ws.readyState !== WebSocket.OPEN) return;
    state.ws.send(JSON.stringify({ type: 'input', input }));
  }

  function releaseLeft() { send({ type: 'up' }); }

  function handleMotion(event) {
    if (!state.permission || !state.active || !state.connected) return;
    const rr = event.rotationRate;
    if (!rr || rr.alpha == null || rr.gamma == null) return;
    let dx = -rr.gamma * state.sensitivity * 0.05;
    let dy = -rr.alpha * state.sensitivity * 0.05;
    if (Math.abs(dx) < 0.45) dx = 0;
    if (Math.abs(dy) < 0.45) dy = 0;
    dx = Math.round(dx);
    dy = Math.round(dy);
    if (dx || dy) send({ type: 'move', dx, dy });
  }

  async function requestWakeLock() {
    if (!('wakeLock' in navigator) || document.visibilityState !== 'visible') return;
    try { state.wakeLock = await navigator.wakeLock.request('screen'); } catch (_) {}
  }

  els.start.addEventListener('click', async () => {
    try {
      if (typeof DeviceMotionEvent !== 'undefined' && typeof DeviceMotionEvent.requestPermission === 'function') {
        const result = await DeviceMotionEvent.requestPermission();
        if (result !== 'granted') throw new Error('Motion permission was not granted');
      }
      state.permission = true;
      addEventListener('devicemotion', handleMotion, { passive: true });
      await requestWakeLock();
      els.gate.classList.add('hidden');
      updateUi();
    } catch (error) {
      els.gateNote.textContent = error.message || String(error);
    }
  });

  els.sensitivity.addEventListener('input', () => {
    state.sensitivity = Number(els.sensitivity.value) || 10;
    els.sensitivityValue.textContent = String(state.sensitivity);
  });

  els.pause.addEventListener('click', () => {
    if (state.active) releaseLeft();
    state.active = !state.active;
    updateUi();
  });
  els.motionPad.addEventListener('click', () => els.pause.click());

  els.left.addEventListener('pointerdown', (event) => { event.preventDefault(); els.left.setPointerCapture?.(event.pointerId); send({ type: 'down' }); });
  els.left.addEventListener('pointerup', (event) => { event.preventDefault(); releaseLeft(); });
  els.left.addEventListener('pointercancel', releaseLeft);
  els.right.addEventListener('pointerdown', (event) => { event.preventDefault(); send({ type: 'right' }); });

  let scrollY = null;
  els.scroll.addEventListener('pointerdown', (event) => { event.preventDefault(); scrollY = event.clientY; els.scroll.setPointerCapture?.(event.pointerId); });
  els.scroll.addEventListener('pointermove', (event) => {
    if (scrollY == null) return;
    const diff = scrollY - event.clientY;
    if (Math.abs(diff) < 5) return;
    send({ type: 'scroll', delta: Math.sign(diff) * 120 });
    scrollY = event.clientY;
  });
  ['pointerup', 'pointercancel'].forEach((name) => els.scroll.addEventListener(name, () => { scrollY = null; }));

  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState !== 'visible') {
      releaseLeft();
      state.active = false;
      updateUi();
    } else if (state.permission) {
      requestWakeLock();
    }
  });
  addEventListener('pagehide', releaseLeft);
  addEventListener('blur', releaseLeft);

  setInterval(() => {
    if (state.ws && state.ws.readyState === WebSocket.OPEN) state.ws.send(JSON.stringify({ type: 'ping', at: Date.now() }));
  }, 20000);

  connect();
  updateUi();
})();
