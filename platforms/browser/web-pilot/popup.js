const $ = (id) => document.getElementById(id);
const els = {
  relayUrl: $('relay-url'), relayDot: $('relay-dot'), relayStatus: $('relay-status'),
  phoneDot: $('phone-dot'), phoneStatus: $('phone-status'), pair: $('pair'), trust: $('trust'),
  qr: $('qr'), pairHint: $('pair-hint'), arm: $('arm'), always: $('always'), full: $('full'),
  fullRow: $('full-row'), reset: $('reset'), forget: $('forget'), error: $('error'), buildLabel: $('build-label')
};
let lastState = null;

function setError(value) { els.error.textContent = value || ''; }

async function call(type, extra = {}) {
  const response = await chrome.runtime.sendMessage(Object.assign({ type }, extra));
  if (response && response.error) setError(response.error);
  else setError('');
  if (response) render(response);
  return response;
}

function permissionPattern(value) {
  const url = new URL(value);
  if (!['http:', 'https:'].includes(url.protocol)) throw new Error('Use an http(s) relay URL');
  return `${url.origin}/*`;
}

function render(state) {
  lastState = state;
  els.relayDot.classList.toggle('good', Boolean(state.socketConnected));
  els.relayStatus.textContent = state.socketConnected ? 'Relay connected' : (state.paired ? 'Relay reconnecting…' : 'Relay disconnected');
  els.phoneDot.classList.toggle('good', Boolean(state.controllerConnected));
  els.phoneStatus.textContent = state.controllerConnected ? 'Phone connected' : (state.paired ? 'Waiting for phone' : 'Phone not paired');
  els.arm.textContent = state.armed ? 'Disarm current tab' : 'Arm current tab';
  els.arm.disabled = !state.paired;
  els.fullRow.style.display = state.privilegedBuild ? 'flex' : 'none';
  els.full.checked = Boolean(state.fullMode);
  els.buildLabel.textContent = state.privilegedBuild ? 'Gyroclopter 0.6 skunk · full control' : 'Gyroclopter 0.6 skunk';
  if (state.relayUrl && document.activeElement !== els.relayUrl) els.relayUrl.value = state.relayUrl;
  if (state.qr) {
    els.qr.src = state.qr;
    els.qr.style.display = 'block';
    els.pairHint.textContent = state.controllerConnected ? 'Connected. Point your phone and fly.' : 'Scan this with your phone. The pairing expires automatically.';
  } else {
    els.qr.removeAttribute('src');
    els.qr.style.display = 'none';
    els.pairHint.textContent = 'Private testing: start the relay, trust its local certificate once, then pair.';
  }
}

els.trust.addEventListener('click', async () => {
  try {
    const relay = els.relayUrl.value.trim();
    await chrome.tabs.create({ url: `${new URL(relay).origin}/health` });
    setError('Accept the certificate warning in that tab once, then return here.');
  } catch (error) { setError(error.message); }
});

els.pair.addEventListener('click', async () => {
  try {
    const relay = els.relayUrl.value.trim();
    const granted = await chrome.permissions.request({ origins: [permissionPattern(relay)] });
    if (!granted) throw new Error('Relay access was not granted');
    await call('PAIR', { relayUrl: relay });
  } catch (error) { setError(error.message); }
});

els.arm.addEventListener('click', async () => {
  try {
    if (lastState && lastState.armed) await call('DISARM');
    else await call('ARM');
  } catch (error) { setError(error.message); }
});

els.always.addEventListener('click', async () => {
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab || !tab.url || !/^https?:/i.test(tab.url)) throw new Error('Open a normal web page first');
    const pattern = `${new URL(tab.url).origin}/*`;
    const granted = await chrome.permissions.request({ origins: [pattern] });
    if (!granted) throw new Error('Site access was not granted');
    setError('Site access saved. Web Pilot still requires an explicit Arm each time.');
  } catch (error) { setError(error.message); }
});

els.full.addEventListener('change', async () => {
  try { await call('SET_FULL_MODE', { value: els.full.checked }); }
  catch (error) { setError(error.message); }
});

els.reset.addEventListener('click', async () => {
  try {
    await call('RESET_PROFILE');
    setError('This site’s interaction field has been reset.');
  } catch (error) { setError(error.message); }
});

els.forget.addEventListener('click', async () => {
  try { await call('FORGET_PAIRING'); }
  catch (error) { setError(error.message); }
});

async function refresh() {
  try { render(await chrome.runtime.sendMessage({ type: 'GET_STATE' })); }
  catch (error) { setError(error.message); }
}

refresh();
setInterval(refresh, 750);
