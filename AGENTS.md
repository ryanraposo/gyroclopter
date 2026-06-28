# Gyroclopter — Agent Guide

> This file is intended for AI coding agents. It describes the project structure, conventions, and workflows so that agents can make accurate, safe changes without prior knowledge of the codebase.

---

## Project Overview

Gyroclopter is a desktop application that turns a mobile phone into a wireless gyroscopic air mouse. It uses a **dual-binary architecture**:

1. **Neutralinojs desktop app** (`gyroclopter.exe`) — native window + tray icon, spawns the headless server.
2. **Headless server binary** (`gyroclopter-server.exe`) — embedded inside the Neutralino app, extracted at runtime. This is the Node.js server (compiled with `@yao-pkg/pkg`) that runs the HTTPS/WSS server, certificate management, and platform-specific mouse controllers.

The user gets a **single file** (`gyroclopter.exe`) — no Node.js required on the user's machine.

**Key characteristics:**
- The Neutralino desktop app shows a QR code, server status, and connected device count in a native window.
- The server communicates with the desktop app via JSON lines on stdout.
- The mobile client (`client.html`) is served by the server and stays unchanged.
- Self-signed SSL certificates are generated automatically so mobile browsers allow `devicemotion` access over HTTPS.

---

## Technology Stack

| Layer | Technology |
|-------|-------------|
| Desktop shell | Neutralinojs v6 (Webview2 on Windows, WebKitGTK on Linux) |
| Runtime (server) | Node.js 16+, compiled with `@yao-pkg/pkg` (no Node on user machine) |
| WebSocket | `ws` (^8.21.0) |
| QR code | Generated server-side as data URL, displayed in Neutralino UI |
| SSL certificates | `selfsigned` (^5.5.0) |
| Testing | Jest (^29.7.0) — no configuration file, uses defaults |
| Mobile client | Pure HTML/CSS/JS (no frameworks, no build step) |
| Packaging | `@neutralinojs/neu` (`^11.7.2`) — Neutralino build tool |
| Icons | `pngjs` (`^7.0.0`) — custom ICO writer (no external image tooling) |
| Windows installer | NSIS 3.10 (`makensis.exe`) |
| Linux package | `dpkg-deb` (Debian packaging tool) |

**Platform-specific mouse injection:**
- **Windows**: PowerShell with P/Invoke to `user32.dll` `mouse_event` (no extra Node dependencies).
- **Linux (X11)**: `xdotool`
- **Linux (Wayland)**: `ydotool`
- **macOS**: Desktop app runs; mouse injection is **not yet implemented**.

---

## Project Structure

```
gyroclopter/
├── server/                       # Headless server source (compiled with pkg)
│   ├── server.js                 # HTTPS/WSS server + mouse controllers + cert management
│   ├── client.html               # Mobile web client (served by server, unchanged)
│   ├── pkg.config.cjs            # @yao-pkg/pkg config (assets: client.html)
│   └── tests/                    # Jest test suite for server logic
│       ├── certificate.test.js
│       ├── dummy.test.js
│       ├── smoke.test.js
│       └── userstories.test.js
├── desktop/                      # Neutralino desktop app source
│   ├── src/                      # Frontend source (canonical, copied to resources/ at build)
│   │   ├── index.html            # Desktop UI (dark-themed, QR, status, controls)
│   │   ├── main.js               # Neutralino app logic (spawn, tray, events)
│   │   └── style.css
│   └── icons/                    # App icons (populated by build:icons)
├── resources/                    # Neutralino resources directory (build artifact, gitignored)
├── scripts/                      # Build tooling (all Node.js)
│   ├── build-binary.js           # pkg wrapper for server.js
│   ├── build-desktop.js          # Neutralino build: copies source + server binary, runs neu build
│   ├── build-icon.js             # Pure-JS ICO + PNG generator from icon-source.png
│   ├── build-installer-nsi.js    # Locates makensis and runs it against installer.nsi
│   └── build-deb.js              # Assembles dpkg-deb layout and emits .deb
├── dist/                         # Build outputs (gitignored)
├── build/                        # Icon source and generated icon assets
├── neutralino.config.json        # Neutralinojs project configuration
├── installer.nsi                 # NSIS installer script (installs single gyroclopter.exe)
├── package.json                  # npm manifest
├── CHANGELOG.md                  # Release history (Keep a Changelog format)
├── README.md                     # Human-facing documentation
└── .gitignore                    # Git ignore rules
```

**Important notes on file organization:**
- `server/server.js` is the only server-side Node.js file. It exports `getCertificates`, `ensureAppDir`, `getLocalIp`, and `CONFIG` for testing.
- `client.html` is read from disk on every HTTPS request (`getClientHtml()` reads it synchronously).
- The desktop source files in `desktop/src/` are copied to `resources/` at build time. `resources/` is gitignored.
- `neutralino.config.json` at root drives the Neutralino build.

---

## Build and Test Commands

```bash
# Install dependencies
npm install

# Start the headless server (standalone, for testing)
npm start

# Run the Jest test suite (tests server logic only)
npm test

# Full release build (Windows):
#   npm run build:icons   → generates build/icons/*.png + build/icon.ico
#   npm run build:server  → pkg-compiles server/server.js → dist/gyroclopter-<version>.exe
#   npm run build:desktop → copies source + server binary → resources/, then neu build --release
#   npm run build:win-installer → makensis → dist/gyroclopter-setup-<version>.exe
npm run build

# Development: copy desktop source to resources and run Neutralino
npm run dev
```

The Windows job in `.github/workflows/build-release.yml` produces `dist/gyroclopter-setup-<version>.exe` via NSIS.
The Linux job produces `dist/gyroclopter_<version>_amd64.deb` via `dpkg-deb`.

There is no linting or transpilation. The project runs directly from source.

---

## Code Style Guidelines

- **Module system**: CommonJS (`require` / `module.exports`). Do NOT use ES modules (`import`/`export`).
- **Indentation**: 2 spaces.
- **Comments**: Use JSDoc-style block comments for functions and classes.
- **Console output (server.js)**: When spawned as a Neutralino child, output JSON lines on stdout. Use `console.error` for diagnostics.
- **Template literals**: Preferred for multi-line strings (e.g., the inline PowerShell script in `WindowsMouseController`).
- **Optional chaining**: Used in the codebase (`this.process?.stdin?.writable`).
- **Async/await**: Used for certificate generation and other asynchronous operations.

---

## Testing Instructions

Tests are written in Jest and live in the `server/tests/` directory.

**Test conventions:**
- All tests use temporary directories under `os.tmpdir()` to avoid polluting the real certificate directory.
- Tests set `process.env.CERT_DIR` to isolate certificate operations.
- Some tests create their own `http`/`https` servers and `WebSocketServer` instances.
- Tests use `rejectUnauthorized: false` when connecting to HTTPS servers with self-signed certs.

**When adding new functionality:**
- Add corresponding tests in the `server/tests/` directory.
- Ensure `npm test` passes before committing.

---

## Runtime Architecture

### Dual-Binary Architecture

```
gyroclopter.exe (Neutralino, 96 MB)
├── Embedded gyroclopter-server.exe (pkg-built, 95 MB)
└── Desktop UI (HTML/JS/CSS + tray icon)
```

1. User runs `gyroclopter.exe`
2. Neutralino window opens (dark-themed, 480×680)
3. User clicks "Start Server"
4. Neutralino extracts the embedded server binary from resources to a temp directory
5. Neutralino spawns the server as a child process via `os.spawnProcess()`
6. Server emits JSON lines on stdout:
   - `{"event":"started","ip":"192.168.1.5","port":8443,"qr":"data:image/png;base64,..."}`
   - `{"event":"connection","count":1}`
   - `{"event":"disconnection","count":0}`
7. Neutralino UI parses these lines to show QR code, URL, status, connected count
8. Close window → minimizes to tray. Tray "Quit" → kills server + exits

### Server (`server/server.js`)

1. **Windows console spawner** (lines 12–31): If running on Windows without `IS_CHILD` or `IS_NEUTRALINO_CHILD` set, re-spawns itself in a visible `cmd.exe` window and exits the parent process.
2. **Configuration** (`CONFIG` object): `PORT: 8443`, `APP_DIR: <os.tmpdir()>/gyroclopter`, `MOUSE_SENSITIVITY_MULTIPLIER: 1.2`.
3. **Certificate management** (`getCertificates`): Generates or reuses self-signed SSL certs in `APP_DIR` (or `CERT_DIR` if overridden).
4. **Mouse controllers**:
   - `WindowsMouseController` — spawns PowerShell, communicates via stdin.
   - `LinuxMouseController` — detects X11 vs Wayland, uses `exec()` for `xdotool`/`ydotool`.
   - `GenericMouseController` — auto-selects platform-specific controller.
5. **`main()`**: Creates HTTPS server (serves `client.html`), attaches WebSocket server, handles 5 message types (`move`, `down`, `up`, `right`, `scroll`), outputs JSON status to stdout, and sets up graceful shutdown on `SIGINT`/`SIGTERM`.

### Desktop UI (`desktop/src/`)

- Runs in Neutralinojs Webview2 (Windows) or WebKitGTK (Linux).
- Uses Neutralino native APIs:
  - `Neutralino.os.spawnProcess()` / `updateSpawnedProcess()` — manage server lifecycle
  - `Neutralino.tray.setTray()` / tray events — system tray icon
  - `Neutralino.events.on('spawnedProcess', ...)` — parse server stdout
  - `Neutralino.window.hide()` / `show()` — minimize to tray
- Dark-themed UI matching mobile aesthetic.
- QR code displayed as `<img>` with base64 data URL from server.
- MVP features: start/stop server, QR display, connection count, tray minimize.

### Client (`client.html`)

- Single-page dark-themed mobile web app.
- Uses `DeviceMotionEvent` / `devicemotion` for gyroscope access.
- Connects to the server via native `WebSocket` with auto-reconnect on disconnect.
- Two-step onboarding: Permissions → Calibration.
- Controls: main pad (toggle active/paused), left/right click buttons, scroll area, sensitivity slider (1–25).
- Uses CSS custom properties for theming.
- **Completely unchanged** by the Neutralino migration.

---

## Environment Variables

| Variable | Purpose |
|----------|---------|
| `CERT_DIR` | Override directory for `key.pem` and `cert.pem`. Defaults to `os.tmpdir()/gyroclopter`. |
| `IS_CHILD` | Internal flag used to prevent infinite console spawning on Windows. |
| `IS_NEUTRALINO_CHILD` | Set by the Neutralino parent (or externally) to prevent console window spawning. |

---

## Deployment and Distribution

- **Port**: Hardcoded to `8443` in `CONFIG`.
- **SSL**: Auto-generated self-signed certificates stored in the OS temp directory (or `CERT_DIR`).
- **Distribution**: single `gyroclopter.exe` (Windows) or `gyroclopter` Linux binary. No Node.js required.
- **No CI for tests**: There is currently no automated CI configured.

---

## Security Considerations

- The server uses **self-signed SSL certificates** generated at runtime. Mobile browsers will show a certificate warning; users must manually accept it.
- The server listens on `0.0.0.0:8443` — it is exposed to the local network. There is no authentication or access control beyond LAN reachability.
- The WebSocket server accepts any connection without origin checking or token validation.
- Mouse injection commands are executed with the privileges of the user running the server (PowerShell on Windows, `xdotool`/`ydotool` on Linux).
- **Do not commit real certificates**: The `.gitignore` already ignores the temp directory and build outputs, but be careful not to add `key.pem` or `cert.pem` to version control.

---

## Known Issues and Quirks

1. **No macOS mouse support**: `GenericMouseController` falls through to `LinuxMouseController` on non-Windows, but macOS mouse injection is not implemented.
2. **No linting or formatting tooling**: No ESLint, Prettier, or similar is configured.
3. **Dual-binary size**: The final `gyroclopter.exe` is ~97 MB due to the embedded pkg server binary (~95 MB). This is a known trade-off for zero-dependency distribution.
4. **Neutralino on Linux**: Requires `webkit2gtk-4.0` on Linux.
5. **Resources extracted on every launch**: The embedded `resources.neu` (including the server binary) is extracted to a temp directory each time the app starts, adding ~1-2 seconds to startup.

---

## Contributing Checklist (from README)

1. Fork the repository.
2. Create a branch for your feature or bug fix.
3. Add tests for new functionality.
4. Make sure `npm test` passes.
5. Open a pull request describing the change.

Follow the existing style: CommonJS modules, 2-space indentation, and clear commit messages.
