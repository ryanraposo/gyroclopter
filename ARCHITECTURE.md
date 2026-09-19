# Gyroclopter Architecture

Gyroclopter has three independent concerns:

1. **Transport** — the phone connects over HTTPS/WSS on the LAN.
2. **Input protocol** — mobile events become a small stable command vocabulary.
3. **Platform input** — a backend turns those commands into host interaction.

```
phone / client.html
      │
      │ HTTPS + WSS
      ▼
server.js
      │
      │ move/down/up/right/scroll
      ▼
input/commands.js
      │
      │ MOVE dx dy
      │ LEFT_DOWN
      │ LEFT_UP
      │ CLICK_RIGHT
      │ SCROLL delta
      ▼
input backend
      ├── windows.js
      ├── linux.js
      ├── chromeos.js
      └── unsupported.js
```

## Boundary

`server.js` owns certificates, LAN discovery, HTTP/WSS lifecycle, connection
counting, and shutdown.

`input/commands.js` owns validation and translation from wire messages to the
platform-neutral command vocabulary.

Each file under `input/` owns one host integration. A backend implements:

- `name`
- `available`
- `sendCommand(command)`
- `dispose()`

Backends do not know about WebSocket payloads, QR pairing, sensitivity UI, or
the mobile client.

## Backend selection

`input/index.js` selects the host backend. Native defaults are explicit:

- `win32` → Windows
- `linux` → Linux
- everything else → unsupported

`GYROCLOPTER_INPUT_BACKEND` exists as an explicit override for development and
platform bridges. Unknown values fail immediately rather than silently falling
back to Linux.

## Why this shape

The stable command boundary lets new targets reuse the existing product instead
of forking it. A future platform can use a native API, helper process, browser
extension, accessibility surface, or network bridge without changing the phone
protocol or duplicating the server.

The rule is simple: platform-specific privilege belongs behind the input
controller boundary.

## ChromeOS bridge

ChromeOS keeps Crostini isolated from the host input stack, so the ChromeOS
backend is a bridge rather than a Linux mouse injector.

`input/chromeos.js` listens only on `127.0.0.1:8444`. ChromeOS automatically
tunnels Linux localhost ports into the host browser. The unpacked MV3 extension
in `chromeos/extension/` connects to that bridge and uses the ChromeOS desktop
Automation tree.

The phone protocol remains unchanged:

```
phone → WSS :8443 → input/commands.js → chromeos.js
                                      → WS localhost:8444
                                      → ChromeOS extension
                                      → chrome.automation desktop actions
```

The ChromeOS backend is explicit during this hardware-validation phase:

```bash
GYROCLOPTER_INPUT_BACKEND=chromeos npm start
```

No ChromeOS behavior is inferred from `process.platform === "linux"`.
