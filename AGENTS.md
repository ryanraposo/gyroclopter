# Gyroclopter — Agent Guide

> This file is intended for AI coding agents. It describes the project structure, conventions, and workflows so that agents can make accurate, safe changes without prior knowledge of the codebase.

---

## Project Overview

Gyroclopter is a Node.js application that turns a mobile phone into a wireless gyroscopic air mouse for a desktop computer. It runs a tiny HTTPS/WebSocket server on the desktop and serves a full-screen mobile web client. The phone's gyroscope data is streamed over WebSocket to control the desktop mouse cursor in real time.

**Key characteristics:**
- Single-server architecture: one `server.js` file contains the HTTPS server, WebSocket server, certificate management, and platform-specific mouse controllers.
- No build step or bundler: the client is a static HTML file (`client.html`) served at runtime.
- Self-signed SSL certificates are generated automatically so mobile browsers allow `devicemotion` access over HTTPS.
- A terminal QR code is printed for instant LAN pairing.

---

## Technology Stack

| Layer | Technology |
|-------|-------------|
| Runtime | Node.js 16+ (CommonJS modules) |
| WebSocket | `ws` (^8.21.0) |
| QR code | `qrcode` (^1.5.4) |
| SSL certificates | `selfsigned` (^5.5.0) |
| Testing | Jest (^29.7.0) — no configuration file, uses defaults |
| Client | Pure HTML/CSS/JS (no frameworks, no build step) |

**Platform-specific mouse injection:**
- **Windows**: PowerShell with P/Invoke to `user32.dll` `mouse_event` (no extra Node dependencies).
- **Linux (X11)**: `xdotool`
- **Linux (Wayland)**: `ydotool`
- **macOS**: Server runs; mouse injection is **not yet implemented**.

---

## Project Structure

```
gyroclopter/
├── server.js                 # Main entry point — HTTPS/WebSocket server + mouse controllers
├── client.html               # Single-file mobile web client (HTML/CSS/JS)
├── package.json              # npm manifest
├── package-lock.json         # Locked dependency tree
├── CHANGELOG.md              # Release history (Keep a Changelog format)
├── README.md                 # Human-facing documentation
├── tests/                    # Jest test suite
│   ├── certificate.test.js   # Certificate generation and reuse tests
│   ├── dummy.test.js           # Utility function tests (getLocalIp, ensureAppDir)
│   ├── smoke.test.js           # Server smoke tests (HTML serving, WebSocket commands)
│   └── userstories.test.js     # WebSocket user story / command flow tests
├── .github/
│   └── workflows/
│       └── exe-generation.yml  # Manual GitHub Actions workflow for Windows EXE build
└── .gitignore                # Git ignore rules
```

**Important notes on file organization:**
- `server.js` is the only server-side file. It exports `getCertificates`, `ensureAppDir`, `getLocalIp`, and `CONFIG` for testing.
- `client.html` is read from disk on every HTTPS request (`getClientHtml()` reads it synchronously).
- There is no `src/` directory, no bundler, and no transpilation.

---

## Build and Test Commands

```bash
# Install dependencies
npm install

# Start the server (runs server.js directly)
npm start

# Run the Jest test suite
npm test
```

There is no build step, no linting, and no transpilation. The project runs directly from source.

---

## Code Style Guidelines

- **Module system**: CommonJS (`require` / `module.exports`). Do NOT use ES modules (`import`/`export`).
- **Indentation**: 2 spaces.
- **Comments**: Use JSDoc-style block comments for functions and classes.
- **Console output**: Use ANSI color codes (`\x1b[36m`, `\x1b[0m`, etc.) for terminal styling. Do NOT double-escape them (e.g., `\\x1b` is a bug).
- **Template literals**: Preferred for multi-line strings (e.g., the inline PowerShell script in `WindowsMouseController`).
- **Optional chaining**: Used in the codebase (`this.process?.stdin?.writable`).
- **Async/await**: Used for certificate generation and other asynchronous operations.

---

## Testing Instructions

Tests are written in Jest and live in the `tests/` directory.

**Test conventions:**
- All tests use temporary directories under `os.tmpdir()` to avoid polluting the real certificate directory.
- Tests set `process.env.CERT_DIR` to isolate certificate operations.
- Some tests create their own `http`/`https` servers and `WebSocketServer` instances.
- Tests use `rejectUnauthorized: false` when connecting to HTTPS servers with self-signed certs.

**When adding new functionality:**
- Add corresponding tests in the `tests/` directory.
- Ensure `npm test` passes before committing.

---

## Runtime Architecture

### Server (`server.js`)

1. **Windows console spawner** (lines 12–20): If running on Windows without `IS_CHILD` set, re-spawns itself in a visible `cmd.exe` window and exits the parent process.
2. **Configuration** (`CONFIG` object): `PORT: 8443`, `APP_DIR: <os.tmpdir()>/gyroclopter`, `MOUSE_SENSITIVITY_MULTIPLIER: 1.2`.
3. **Certificate management** (`getCertificates`): Generates or reuses self-signed SSL certs in `APP_DIR` (or `CERT_DIR` if overridden).
4. **Mouse controllers**:
   - `WindowsMouseController` — spawns PowerShell, communicates via stdin.
   - `LinuxMouseController` — detects X11 vs Wayland, uses `exec()` for `xdotool`/`ydotool`.
   - `GenericMouseController` — auto-selects platform-specific controller.
5. **`main()`**: Creates HTTPS server (serves `client.html`), attaches WebSocket server, handles 5 message types (`move`, `down`, `up`, `right`, `scroll`), prints QR code and instructions, and sets up graceful shutdown on `SIGINT`/`SIGTERM`.

### Client (`client.html`)

- Single-page dark-themed mobile web app.
- Uses `DeviceMotionEvent` / `devicemotion` for gyroscope access.
- Connects to the server via native `WebSocket` with auto-reconnect on disconnect.
- Two-step onboarding: Permissions → Calibration.
- Controls: main pad (toggle active/paused), left/right click buttons, scroll area, sensitivity slider (1–25).
- Uses CSS custom properties for theming.

---

## Environment Variables

| Variable | Purpose |
|----------|---------|
| `CERT_DIR` | Override directory for `key.pem` and `cert.pem`. Defaults to `os.tmpdir()/gyroclopter`. |
| `IS_CHILD` | Internal flag used to prevent infinite console spawning on Windows. |

---

## Deployment and Distribution

- **Port**: Hardcoded to `8443` in `CONFIG`.
- **SSL**: Auto-generated self-signed certificates stored in the OS temp directory (or `CERT_DIR`).
- **GitHub Actions**: `.github/workflows/exe-generation.yml` is a manual workflow for building a Windows executable. It is currently a placeholder — the actual `npx pkg` command is commented out.
- **No CI for tests**: The GitHub Actions workflow does not run `npm test`.

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

---

## Contributing Checklist (from README)

1. Fork the repository.
2. Create a branch for your feature or bug fix.
3. Add tests for new functionality.
4. Make sure `npm test` passes.
5. Open a pull request describing the change.

Follow the existing style: CommonJS modules, 2-space indentation, and clear commit messages.
