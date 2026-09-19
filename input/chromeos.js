const { WebSocket, WebSocketServer } = require('ws');

const DEFAULT_BRIDGE_HOST = '127.0.0.1';
const DEFAULT_BRIDGE_PORT = 8444;
const BRIDGE_PROTOCOL_VERSION = 1;

class ChromeOSInputController {
  constructor(options = {}) {
    this.name = 'chromeos-automation';
    this.available = false;
    this.clients = new Set();
    this.host = options.bridgeHost || DEFAULT_BRIDGE_HOST;
    this.port = options.bridgePort ?? DEFAULT_BRIDGE_PORT;

    this.server = new WebSocketServer({
      host: this.host,
      port: this.port
    });

    this.server.on('listening', () => {
      const address = this.server.address();
      if (address && typeof address === 'object') this.port = address.port;
      console.log(`ChromeOS input bridge listening on ws://${this.host}:${this.port}`);
    });

    this.server.on('connection', (socket) => {
      this.clients.add(socket);
      this.available = true;

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
        }
      });

      socket.on('close', () => {
        this.clients.delete(socket);
        this.available = this.clients.size > 0;
      });

      socket.on('error', () => {
        this.clients.delete(socket);
        this.available = this.clients.size > 0;
      });
    });

    this.server.on('error', (err) => {
      this.available = false;
      console.error('ChromeOS input bridge error:', err);
    });
  }

  sendCommand(command) {
    const payload = JSON.stringify({
      type: 'input',
      command
    });

    for (const socket of this.clients) {
      if (socket.readyState === WebSocket.OPEN) {
        socket.send(payload);
      }
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
