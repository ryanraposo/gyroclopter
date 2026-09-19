const { EventEmitter } = require('events');
const { WebSocket, WebSocketServer } = require('ws');

const DEFAULT_BRIDGE_HOST = '127.0.0.1';
const DEFAULT_BRIDGE_PORT = 8444;
const BRIDGE_PROTOCOL_VERSION = 1;

function isUsableIpv4(value) {
  if (typeof value !== 'string') return false;
  const parts = value.trim().split('.');
  if (parts.length !== 4) return false;
  const octets = parts.map(Number);
  if (octets.some((part) => !Number.isInteger(part) || part < 0 || part > 255)) return false;
  if (octets[0] === 0 || octets[0] === 127) return false;
  if (octets[0] === 169 && octets[1] === 254) return false;
  if (octets[0] >= 224) return false;
  return true;
}

class ChromeOSInputController extends EventEmitter {
  constructor(options = {}) {
    super();
    this.name = 'chromeos-automation';
    this.available = false;
    this.clients = new Set();
    this.host = options.bridgeHost || DEFAULT_BRIDGE_HOST;
    this.port = options.bridgePort ?? DEFAULT_BRIDGE_PORT;

    this.server = new WebSocketServer({ host: this.host, port: this.port });

    this.server.on('listening', () => {
      const address = this.server.address();
      if (address && typeof address === 'object') this.port = address.port;
      console.log(`ChromeOS input bridge listening on ws://${this.host}:${this.port}`);
    });

    this.server.on('connection', (socket) => {
      this.clients.add(socket);
      this.available = true;
      this.emit('availability', true);

      socket.send(JSON.stringify({
        type: 'hello',
        protocol: BRIDGE_PROTOCOL_VERSION,
        server: 'gyroclopter'
      }));

      socket.on('message', (raw) => {
        let message;
        try {
          message = JSON.parse(raw.toString());
        } catch (_) {
          return;
        }

        if (message.type === 'ping') {
          socket.send(JSON.stringify({ type: 'pong' }));
        } else if (message.type === 'hello') {
          console.log(`ChromeOS bridge client connected: ${message.client || 'unknown'}`);
          if (isUsableIpv4(message.hostIp)) this.emit('host-address', message.hostIp.trim());
        }
      });

      const removeClient = () => {
        this.clients.delete(socket);
        const available = this.clients.size > 0;
        if (available !== this.available) {
          this.available = available;
          this.emit('availability', available);
        }
      };

      socket.on('close', removeClient);
      socket.on('error', removeClient);
    });

    this.server.on('error', (err) => {
      this.available = false;
      this.emit('availability', false);
      console.error('ChromeOS input bridge error:', err);
    });
  }

  sendCommand(command) {
    const payload = JSON.stringify({ type: 'input', command });
    for (const socket of this.clients) {
      if (socket.readyState === WebSocket.OPEN) socket.send(payload);
    }
  }

  dispose() {
    for (const socket of this.clients) {
      try { socket.close(); } catch (_) {}
    }
    this.clients.clear();
    this.available = false;
    try { this.server.close(); } catch (_) {}
  }
}

module.exports = ChromeOSInputController;
module.exports.DEFAULT_BRIDGE_HOST = DEFAULT_BRIDGE_HOST;
module.exports.DEFAULT_BRIDGE_PORT = DEFAULT_BRIDGE_PORT;
module.exports.BRIDGE_PROTOCOL_VERSION = BRIDGE_PROTOCOL_VERSION;
module.exports.isUsableIpv4 = isUsableIpv4;
