const ipInput=document.getElementById('host-ip');
const tokenInput=document.getElementById('bridge-token');
const saveButton=document.getElementById('save');
const saveStatus=document.getElementById('save-status');
const bridgeDot=document.getElementById('bridge-dot');
const bridgeStatus=document.getElementById('bridge-status');
const automationDot=document.getElementById('automation-dot');
const automationStatus=document.getElementById('automation-status');

function validIpv4(value) {
  const parts=String(value||'').trim().split('.');
  if (parts.length!==4) return false;
  const octets=parts.map(Number);
  if (octets.some((part)=>!Number.isInteger(part)||part<0||part>255)) return false;
  return octets[0]!==0&&octets[0]!==127&&!(octets[0]===169&&octets[1]===254);
}

async function loadSavedIp() {
  const stored=await chrome.storage.local.get(['hostIp','bridgeToken']);
  if (stored.bridgeToken) tokenInput.value=stored.bridgeToken;
  if (stored.hostIp) ipInput.value=stored.hostIp;
}

async function saveIp() {
  const value=ipInput.value.trim();
  if (!validIpv4(value)) {
    saveStatus.textContent='Enter the Chromebook Wi-Fi IPv4 address.';
    return;
  }
  const token=tokenInput.value.trim();
  if (!/^[a-f0-9]{48}$/.test(token)) { saveStatus.textContent='Enter the 48-character token from the host setup.'; return; }
  await chrome.storage.local.set({hostIp:value,bridgeToken:token});
  await chrome.runtime.sendMessage({type:'host-ip-updated'});
  saveStatus.textContent='Saved. Gyroclopter will refresh its pairing address.';
}

async function refreshStatus() {
  try {
    const status=await chrome.runtime.sendMessage({type:'status'});
    bridgeDot.className='dot '+(status.connected?'ready':'error');
    bridgeStatus.textContent=status.connected?'Bridge connected':'Bridge waiting for Gyroclopter';
    automationDot.className='dot '+(status.automationReady?'ready':'error');
    automationStatus.textContent=status.automationReady?'ChromeOS Automation ready':'ChromeOS Automation unavailable';
  } catch (_) {
    bridgeDot.className='dot error';
    bridgeStatus.textContent='Bridge unavailable';
    automationDot.className='dot error';
    automationStatus.textContent='Automation unavailable';
  }
}

saveButton.addEventListener('click',saveIp);
ipInput.addEventListener('keydown',(event)=>{ if(event.key==='Enter') saveIp(); });
loadSavedIp();
refreshStatus();
setInterval(refreshStatus,1200);
