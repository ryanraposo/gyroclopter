const { EventEmitter } = require('events');
const { timingSafeEqual } = require('crypto');
const { isIPv4 } = require('net');
const { WebSocket, WebSocketServer } = require('ws');

const DEFAULT_BRIDGE_HOST = '127.0.0.1';
const DEFAULT_BRIDGE_PORT = 8444;
const BRIDGE_PROTOCOL_VERSION = 1;
const TOKEN_PATTERN = /^[a-f0-9]{48}$/;

function isUsableIpv4(value) {
  if (typeof value !== 'string' || !isIPv4(value.trim())) return false;
  const [a, b] = value.trim().split('.').map(Number);
  return a > 0 && a !== 127 && a < 224 && !(a === 169 && b === 254);
}

class ChromeOSInputController extends EventEmitter {
  constructor(options = {}) {
    super();
    const env = options.env || process.env;
    const token = options.bridgeToken || env.GYROCLOPTER_CHROMEOS_TOKEN;
    if (!TOKEN_PATTERN.test(token || '')) {
      throw new Error('ChromeOS requires GYROCLOPTER_CHROMEOS_TOKEN (48 lowercase hex characters). See platforms/desktop/chromeos/README.md.');
    }
    this.name = 'chromeos-automation';
    this.available = false;
    this.client = null;
    this.port = options.bridgePort ?? DEFAULT_BRIDGE_PORT;
    this.onAvailability = options.onAvailability || (() => {});
    this.onError = options.onError || (() => {});
    this.onPairingAddress = options.onPairingAddress || (() => {});
    const expected = Buffer.from(token, 'hex');
    this.server = new WebSocketServer({ host: DEFAULT_BRIDGE_HOST, port: this.port, maxPayload: 4096 });
    this.server.on('listening', () => { this.port = this.server.address().port; });
    this.server.on('error', error => {
      this.setAvailable(false);
      this.onError({ code: 'CHROMEOS_BRIDGE_ERROR', message: error.message });
    });
    this.server.on('connection', socket => {
      let authenticated = false;
      const timeout = setTimeout(() => { if (!authenticated) socket.close(1008, 'Pairing required'); }, 4000);
      timeout.unref();
      socket.on('message', raw => {
        let message;
        try { message = JSON.parse(raw.toString()); } catch (_) { return; }
        if (message?.type === 'hello') {
          if (!TOKEN_PATTERN.test(message.token || '') ||
              !timingSafeEqual(Buffer.from(message.token, 'hex'), expected) ||
              message.protocol !== BRIDGE_PROTOCOL_VERSION ||
              (this.client && this.client !== socket)) {
            socket.close(1008, 'Pairing rejected');
            return;
          }
          authenticated = true;
          clearTimeout(timeout);
          this.client = socket;
          if (isUsableIpv4(message.hostIp)) {
            const ip = message.hostIp.trim();
            this.emit('host-address', ip);
            this.onPairingAddress(ip);
          }
          this.setAvailable(message.automationReady === true);
          socket.send(JSON.stringify({ type: 'ready', automationReady: this.available }));
        } else if (authenticated && message?.type === 'ping') {
          socket.send(JSON.stringify({ type: 'pong' }));
        }
      });
      const close = () => {
        clearTimeout(timeout);
        if (this.client === socket) {
          this.client = null;
          this.setAvailable(false);
        }
      };
      socket.on('close', close);
      socket.on('error', close);
    });
  }

  setAvailable(value) {
    if (this.available === value) return;
    this.available = value;
    this.emit('availability', value);
    this.onAvailability(value);
  }

  sendCommand(command) {
    if (this.available && this.client?.readyState === WebSocket.OPEN) {
      this.client.send(JSON.stringify({ type: 'input', command }));
    }
  }

  dispose() {
    this.setAvailable(false);
    this.client = null;
    for (const socket of this.server.clients) socket.terminate();
    this.server.close();
  }
}

module.exports = ChromeOSInputController;
module.exports.isUsableIpv4 = isUsableIpv4;
module.exports.DEFAULT_BRIDGE_PORT = DEFAULT_BRIDGE_PORT;
module.exports.BRIDGE_PROTOCOL_VERSION = BRIDGE_PROTOCOL_VERSION;
