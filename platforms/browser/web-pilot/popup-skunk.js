const $ = (id) => document.getElementById(id);
const els = {
  relayUrl: $('relay-url'), relayDot: $('relay-dot'), relayStatus: $('relay-status'),
  phoneDot: $('phone-dot'), phoneStatus: $('phone-status'), qr: $('qr'),
  trust: $('trust'), pair: $('pair'), auto: $('auto'), full: $('full'),
  arm: $('arm'), pause: $('pause'), reset: $('reset'), forget: $('forget'), error: $('error')
};
let state = null;

function err(value) { els.error.textContent = value || ''; }

async function call(type, extra = {}) {
  const response = await chrome.runtime.sendMessage(Object.assign({ type }, extra));
  if (response && response.error) err(response.error); else err('');
  render(response || {});
  return response;
}

function render(next) {
  state = next;
  els.relayDot.classList.toggle('good', Boolean(next.socketConnected));
  els.phoneDot.classList.toggle('good', Boolean(next.controllerConnected));
  els.relayStatus.textContent = next.socketConnected ? 'Relay connected' : (next.paired ? 'Relay reconnecting…' : 'Relay disconnected');
  els.phoneStatus.textContent = next.controllerConnected ? (next.armed ? 'Phone connected · flying' : 'Phone connected · ready') : (next.paired ? 'Waiting for phone' : 'Phone not paired');
  if (next.relayUrl && document.activeElement !== els.relayUrl) els.relayUrl.value = next.relayUrl;
  els.auto.checked = next.autoPilot !== false;
  els.full.checked = Boolean(next.fullMode);
  els.full.disabled = !next.privilegedBuild;
  els.arm.textContent = next.armed ? 'This tab is awake' : 'Wake this tab';
  if (next.qr) { els.qr.src = next.qr; els.qr.style.display = 'block'; }
  else { els.qr.removeAttribute('src'); els.qr.style.display = 'none'; }
}

els.trust.onclick = async () => {
  try {
    const origin = new URL(els.relayUrl.value.trim()).origin;
    await chrome.tabs.create({ url: origin + '/health' });
    err('Accept the local certificate once, then return here.');
  } catch (e) { err(e.message); }
};

els.pair.onclick = async () => {
  try { await call('PAIR', { relayUrl: els.relayUrl.value.trim() }); }
  catch (e) { err(e.message); }
};

els.auto.onchange = () => call('SET_AUTO_PILOT', { value: els.auto.checked }).catch((e) => err(e.message));
els.full.onchange = () => call('SET_FULL_MODE', { value: els.full.checked }).catch((e) => err(e.message));
els.arm.onclick = () => call('ARM').catch((e) => err(e.message));
els.pause.onclick = async () => {
  els.auto.checked = false;
  await call('SET_AUTO_PILOT', { value: false }).catch((e) => err(e.message));
};
els.reset.onclick = () => call('RESET_PROFILE').then(() => err('Site learning reset.')).catch((e) => err(e.message));
els.forget.onclick = () => call('FORGET_PAIRING').catch((e) => err(e.message));

async function refresh() {
  try { render(await chrome.runtime.sendMessage({ type: 'GET_STATE' })); }
  catch (e) { err(e.message); }
}
refresh();
setInterval(refresh, 750);
