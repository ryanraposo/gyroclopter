const fs = require('fs');
const path = require('path');
const os = require('os');
const crypto = require('crypto');
const http = require('http');
const https = require('https');
const WebSocket = require('ws');
const QRCode = require('qrcode');
const selfsigned = require('selfsigned');

const PORT = Number(process.env.WEB_PILOT_PORT || 9443);
const BIND = process.env.WEB_PILOT_BIND || '0.0.0.0';
const PLAIN_HTTP = process.env.WEB_PILOT_PLAIN_HTTP === '1';
const SESSION_TTL_MS = Number(process.env.WEB_PILOT_SESSION_TTL_MS || 12 * 60 * 60 * 1000);
const MAX_SESSIONS = Number(process.env.WEB_PILOT_MAX_SESSIONS || 64);
const MAX_INPUTS_PER_SECOND = Number(process.env.WEB_PILOT_MAX_INPUTS_PER_SECOND || 180);
const PUBLIC_BASE_URL = process.env.PUBLIC_BASE_URL ? String(process.env.PUBLIC_BASE_URL).replace(/\/$/, '') : null;
const CONTROLLER_URL = String(process.env.WEB_PILOT_CONTROLLER_URL || 'https://ryanraposo.github.io/gyroclopter/').replace(/#.*$/, '');
const ALLOWED_EXTENSION_IDS = new Set(String(process.env.WEB_PILOT_EXTENSION_IDS || '').split(',').map((v) => v.trim()).filter(Boolean));
const sessions = new Map();
const createRate = new Map();

function getLocalIp() {
  const interfaces = os.networkInterfaces();
  for (const name of Object.keys(interfaces)) {
    for (const iface of interfaces[name] || []) {
      if (iface.family === 'IPv4' && !iface.internal) return iface.address;
    }
  }
  return '127.0.0.1';
}

function publicBaseUrl() {
  if (PUBLIC_BASE_URL) return PUBLIC_BASE_URL;
  const scheme = PLAIN_HTTP ? 'http' : 'https';
  return `${scheme}://${getLocalIp()}:${PORT}`;
}

function randomToken(bytes) {
  return crypto.randomBytes(bytes).toString('base64url');
}

function safeEqual(a, b) {
  const aa = Buffer.from(String(a || ''));
  const bb = Buffer.from(String(b || ''));
  return aa.length === bb.length && crypto.timingSafeEqual(aa, bb);
}

function validateInput(input) {
  if (!input || typeof input.type !== 'string') return null;
  if (input.type === 'move') {
    const dx = Number(input.dx);
    const dy = Number(input.dy);
    if (!Number.isFinite(dx) || !Number.isFinite(dy)) return null;
    if (Math.abs(dx) > 120 || Math.abs(dy) > 120) return null;
    return { type: 'move', dx, dy };
  }
  if (input.type === 'scroll') {
    const delta = Number(input.delta);
    if (!Number.isFinite(delta) || Math.abs(delta) > 600) return null;
    return { type: 'scroll', delta };
  }
  if (['down', 'up', 'right'].includes(input.type)) return { type: input.type };
  return null;
}

function originAllowedForPilot(origin) {
  if (!origin) return process.env.NODE_ENV !== 'production';
  if (!origin.startsWith('chrome-extension://')) return false;
  if (ALLOWED_EXTENSION_IDS.size === 0) return true;
  try {
    const id = new URL(origin).host;
    return ALLOWED_EXTENSION_IDS.has(id);
  } catch (_) {
    return false;
  }
}

function originAllowedForController(origin) {
  if (!origin) return process.env.NODE_ENV !== 'production';
  try { return new URL(origin).origin === new URL(CONTROLLER_URL).origin || new URL(origin).origin === new URL(publicBaseUrl()).origin; }
  catch (_) { return false; }
}

function securityHeaders(res) {
  res.setHeader('cache-control', 'no-store');
  res.setHeader('x-content-type-options', 'nosniff');
  res.setHeader('referrer-policy', 'no-referrer');
  res.setHeader('permissions-policy', 'camera=(), microphone=(), geolocation=()');
  res.setHeader('content-security-policy', "default-src 'self'; connect-src 'self' ws: wss:; img-src 'self' data:; style-src 'self'; script-src 'self'; base-uri 'none'; frame-ancestors 'none'; form-action 'none'");
}

function sendJson(res, status, value) {
  securityHeaders(res);
  res.writeHead(status, { 'content-type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify(value));
}

function sendFile(res, file, type) {
  securityHeaders(res);
  try {
    const content = fs.readFileSync(path.join(__dirname, file));
    res.writeHead(200, { 'content-type': type });
    res.end(content);
  } catch (_) {
    res.writeHead(404);
    res.end('not found');
  }
}

function clientIp(req) {
  return String(req.socket.remoteAddress || 'unknown');
}

function allowSessionCreate(req) {
  const ip = clientIp(req);
  const now = Date.now();
  const record = createRate.get(ip) || { start: now, count: 0 };
  if (now - record.start > 60_000) { record.start = now; record.count = 0; }
  record.count += 1;
  createRate.set(ip, record);
  return record.count <= 20;
}

async function createSession() {
  if (sessions.size >= MAX_SESSIONS) throw new Error('Relay session capacity reached');
  const room = randomToken(12);
  const key = randomToken(24);
  const now = Date.now();
  const controllerUrl = `${CONTROLLER_URL}#relay=${encodeURIComponent(publicBaseUrl())}&room=${encodeURIComponent(room)}&key=${encodeURIComponent(key)}`;
  const qr = await QRCode.toDataURL(controllerUrl, { margin: 1, width: 420, errorCorrectionLevel: 'M' });
  sessions.set(room, {
    room, key, createdAt: now, lastActivity: now, pilot: null, controller: null
  });
  return { room, key, controllerUrl, qr, expiresAt: new Date(now + SESSION_TTL_MS).toISOString() };
}

function notifyPeer(session, role, connected) {
  const other = role === 'pilot' ? session.controller : session.pilot;
  if (other && other.readyState === WebSocket.OPEN) {
    other.send(JSON.stringify({ type: 'peer', role, connected }));
  }
}

function closeSessionSocket(session, role, ws) {
  if (session[role] === ws) session[role] = null;
  notifyPeer(session, role, false);
}

function attachWsServer(server) {
  const wss = new WebSocket.Server({ server, path: '/ws', maxPayload: 4096, perMessageDeflate: false, clientTracking: false });
  wss.on('connection', (ws, req) => {
    ws._authenticated = false;
    ws._origin = req.headers.origin || '';
    ws._rate = { start: Date.now(), count: 0 };
    let session = null;
    let role = null;
    const authTimer = setTimeout(() => { if (!ws._authenticated) ws.close(1008, 'authentication timeout'); }, 5000);

    ws.on('message', (raw) => {
      let message;
      try { message = JSON.parse(raw.toString()); } catch (_) { ws.close(1003, 'invalid json'); return; }

      if (!ws._authenticated) {
        if (message.type !== 'hello' || !['pilot', 'controller'].includes(message.role)) { ws.close(1008, 'hello required'); return; }
        session = sessions.get(String(message.room || ''));
        role = message.role;
        if (!session || !safeEqual(session.key, message.key)) { ws.close(1008, 'invalid session'); return; }
        if (Date.now() - session.createdAt > SESSION_TTL_MS) { sessions.delete(session.room); ws.close(1008, 'session expired'); return; }
        if (role === 'pilot' && !originAllowedForPilot(ws._origin)) { ws.close(1008, 'pilot origin denied'); return; }
        if (role === 'controller' && !originAllowedForController(ws._origin)) { ws.close(1008, 'controller origin denied'); return; }
        if (session[role] && session[role] !== ws && session[role].readyState === WebSocket.OPEN) session[role].close(4001, 'replaced');
        session[role] = ws;
        session.lastActivity = Date.now();
        ws._authenticated = true;
        clearTimeout(authTimer);
        ws.send(JSON.stringify({ type: 'hello-ack', role }));
        notifyPeer(session, role, true);
        const otherRole = role === 'pilot' ? 'controller' : 'pilot';
        ws.send(JSON.stringify({ type: 'peer', role: otherRole, connected: Boolean(session[otherRole] && session[otherRole].readyState === WebSocket.OPEN) }));
        return;
      }

      session.lastActivity = Date.now();
      if (message.type === 'ping') { ws.send(JSON.stringify({ type: 'pong', at: Date.now() })); return; }

      if (role === 'controller' && message.type === 'input') {
        const now = Date.now();
        if (now - ws._rate.start >= 1000) { ws._rate.start = now; ws._rate.count = 0; }
        ws._rate.count += 1;
        if (ws._rate.count > MAX_INPUTS_PER_SECOND) { ws.close(1008, 'input rate exceeded'); return; }
        const input = validateInput(message.input);
        if (!input) return;
        if (session.pilot && session.pilot.readyState === WebSocket.OPEN) {
          session.pilot.send(JSON.stringify({ type: 'input', input }));
        }
        return;
      }

      if (role === 'pilot' && message.type === 'pilot-status') {
        if (session.controller && session.controller.readyState === WebSocket.OPEN) {
          session.controller.send(JSON.stringify({ type: 'pilot-status', armed: Boolean(message.armed), fullMode: Boolean(message.fullMode) }));
        }
      }
    });

    ws.on('close', () => {
      clearTimeout(authTimer);
      if (session && role) closeSessionSocket(session, role, ws);
    });
    ws.on('error', () => {});
  });
  return wss;
}

async function getTlsOptions() {
  if (process.env.WEB_PILOT_TLS_KEY && process.env.WEB_PILOT_TLS_CERT) {
    return {
      key: fs.readFileSync(process.env.WEB_PILOT_TLS_KEY),
      cert: fs.readFileSync(process.env.WEB_PILOT_TLS_CERT)
    };
  }
  const certDir = process.env.WEB_PILOT_CERT_DIR || path.join(os.homedir(), '.gyroclopter', 'web-pilot');
  fs.mkdirSync(certDir, { recursive: true, mode: 0o700 });
  const keyPath = path.join(certDir, 'key.pem');
  const certPath = path.join(certDir, 'cert.pem');
  if (fs.existsSync(keyPath) && fs.existsSync(certPath)) return { key: fs.readFileSync(keyPath), cert: fs.readFileSync(certPath) };
  const localIp = getLocalIp();
  const pems = await selfsigned.generate([{ name: 'commonName', value: 'Gyroclopter Web Pilot' }], {
    days: 365,
    keySize: 2048,
    extensions: [{
      name: 'subjectAltName',
      altNames: [
        { type: 2, value: 'localhost' },
        { type: 7, ip: '127.0.0.1' },
        { type: 7, ip: localIp }
      ]
    }]
  });
  fs.writeFileSync(keyPath, pems.private, { mode: 0o600 });
  fs.writeFileSync(certPath, pems.cert, { mode: 0o600 });
  return { key: pems.private, cert: pems.cert };
}

async function main() {
  if (!Number.isInteger(PORT) || PORT < 1 || PORT > 65535) throw new Error('Invalid WEB_PILOT_PORT');
  if (process.env.NODE_ENV === 'production') {
    if (!PUBLIC_BASE_URL || !PUBLIC_BASE_URL.startsWith('https://')) throw new Error('Production requires PUBLIC_BASE_URL=https://…');
  }

  const handler = async (req, res) => {
    const url = new URL(req.url, publicBaseUrl());
    if (req.method === 'GET' && url.pathname === '/health') return sendJson(res, 200, { ok: true, name: 'Gyroclopter Web Pilot relay', version: '0.6-skunk' });
    if (req.method === 'POST' && url.pathname === '/api/session') {
      if (!allowSessionCreate(req)) return sendJson(res, 429, { error: 'Too many pairing requests' });
      try { return sendJson(res, 201, await createSession()); }
      catch (error) { return sendJson(res, 503, { error: error.message }); }
    }
    if (req.method === 'GET' && url.pathname === '/controller') return sendFile(res, 'controller.html', 'text/html; charset=utf-8');
    if (req.method === 'GET' && url.pathname === '/controller.js') return sendFile(res, 'controller.js', 'text/javascript; charset=utf-8');
    if (req.method === 'GET' && url.pathname === '/controller.css') return sendFile(res, 'controller.css', 'text/css; charset=utf-8');
    if (req.method === 'GET' && url.pathname === '/') {
      securityHeaders(res);
      res.writeHead(200, { 'content-type': 'text/plain; charset=utf-8' });
      return res.end('Gyroclopter Web Pilot relay is running. Pair from the browser extension.\n');
    }
    sendJson(res, 404, { error: 'not found' });
  };

  const server = PLAIN_HTTP ? http.createServer(handler) : https.createServer(await getTlsOptions(), handler);
  attachWsServer(server);
  server.listen(PORT, BIND, () => {
    const local = `${PLAIN_HTTP ? 'http' : 'https'}://127.0.0.1:${PORT}`;
    console.log(`Gyroclopter Web Pilot relay\n  Extension: ${local}\n  Phone/LAN:  ${publicBaseUrl()}\n  Health:     ${local}/health`);
    if (!PLAIN_HTTP) console.log('Accept the self-signed certificate once on desktop and phone during private testing.');
  });

  const reap = setInterval(() => {
    const now = Date.now();
    for (const [room, session] of sessions) {
      if (now - session.lastActivity <= SESSION_TTL_MS) continue;
      for (const role of ['pilot', 'controller']) {
        if (session[role] && session[role].readyState === WebSocket.OPEN) session[role].close(1001, 'session expired');
      }
      sessions.delete(room);
    }
  }, 60_000);
  reap.unref();
}

if (require.main === module) main().catch((error) => { console.error(error); process.exit(1); });

module.exports = {
  validateInput,
  safeEqual,
  originAllowedForPilot,
  originAllowedForController,
  getLocalIp,
  publicBaseUrl,
  createSession
};
