# AGENTS.md – Project Directives for AI Agents

*This file supplies concise, AI‑agent friendly directives for the **Gyroclopter** repo.*

---

## General Guidelines
- Run `npm test` (Jest) before committing.
- Run `npm run build` before releasing a new version.
- Prefer the built‑in npm scripts; avoid ad‑hoc commands.
- Do **not** commit generated binaries or temporary artefacts (`dist/`, `resources/`).

---

## Tooling Preferences
- Enable toolsets: `web`, `terminal`, `file`.
- Destructive commands require explicit confirmation (e.g., `--yolo` flag).
- When using terminal:
  - Short tasks → foreground.
  - Long‑running builds/tests → background with completion notification.

---

## Build & Test Commands
```bash
# Install dependencies (once)
npm install

# Run the Jest test suite
npm test

# Build the full application (Electron for Windows + Linux)
npm run build
```
- Test suite must exit with code 0 before any commit.
- Build produces installers in `dist/`:
  - Windows: `Gyroclopter-0.4.0.exe` (NSIS installer)
  - Linux: `gyroclopter_0.4.0_amd64.deb` (Debian package)

---

## CHANGELOG Maintenance

See [RELEASE.md](RELEASE.md) for instructions on updating `CHANGELOG.md` before merging to `main`.

---

## Code Style Guidelines
- **CommonJS** (`require` / `module.exports`).
- Indentation: **2 spaces**.
- Prefer modern JavaScript/TypeScript where appropriate.
- Use the provided `logger` utility instead of `console.log` in production.
- JSDoc‑style block comments for functions and classes.
- Async/await for asynchronous operations (e.g., certificate generation).

---

## Runtime Architecture (Reference)

**📋 See [ARCHITECTURE.md](ARCHITECTURE.md) for complete application documentation.**

### High-Level Overview
- **Electron Desktop App** - System tray UI, server lifecycle management, IPC
- **HTTPS/WSS Server** (`server.js`) - Serves mobile client, handles WebSocket commands
- **Mobile Web Client** (`client.html`) - Captures device motion, sends mouse commands over LAN

### Data Flow
```
Electron Main → spawns → server.js (child process)
                      ↓
              HTTPS :8443 + WebSocket
                      ↓
              Mobile browser (LAN)
                      ↓
          DeviceMotion → WS commands → Mouse injection
```

### Platform-Specific Mouse Injection
- **Windows**: PowerShell + P/Invoke (`user32.dll::mouse_event`)
  - Spawns temp `.ps1` script, waits for "READY" signal
  - Command protocol: `MOVE dx dy`, `LEFT_DOWN`, `LEFT_UP`, `CLICK_RIGHT`, `SCROLL delta`
- **Linux (X11)**: `xdotool` commands
- **Linux (Wayland)**: `ydotool` commands
- **macOS**: **Not implemented** – avoid adding macOS mouse controls

### JSON stdout Protocol (Server → Electron)
Server emits structured JSON lines for parent process integration:
```json
{ "event": "started", "ip": "192.168.1.100", "port": 8443, "qr": "data:image/png;base64,..." }
{ "event": "connection", "count": 1 }
{ "event": "disconnection", "count": 0 }
{ "event": "stopped" }
{ "event": "error", "code": "EADDRINUSE", "message": "..." }
```

### SSL Certificates
- Self-signed, generated at runtime using `selfsigned` library
- Stored in OS temp dir (`/tmp/gyroclopter/` or `CERT_DIR` env var)
- Valid for 365 days, reused if valid PEM files exist
- Required for mobile browsers to allow DeviceMotion API access

### Key Files
| File | Purpose |
|------|---------|
| `app/electron-main.js` | Main process: tray, IPC, server spawn/lifecycle |
| `app/preload.js` | Secure IPC bridge (context isolation) |
| `app/renderer.js` | UI controller: QR display, status, buttons |
| `server.js` | Core engine: HTTPS, WSS, mouse controllers |
| `client.html` | Mobile web client: gyro controls, WebSocket |

---

## 📁 Project Structure

```
gyroclopter/
├── app/                          # Electron desktop UI
│   ├── electron-main.js          # Main process: tray, IPC, server lifecycle
│   ├── preload.js                # IPC bridge (context isolation)
│   ├── renderer.js               # UI controller (QR, status, buttons)
│   ├── index.html                # Desktop UI structure
│   ├── style.css                 # Desktop UI styling (dark theme)
│   └── favicon.ico               # Tray/app icon (16x16)
│
├── server.js                     # Core server (HTTPS + WSS + mouse control)
├── client.html                   # Mobile web client (gyro controls)
│
├── tests/                        # Jest test suite
│   ├── gyroclopter.test.js       # Certificate, HTTP, WebSocket tests
│   ├── server-path.test.js       # Path resolution tests
│   └── start-server-integration.test.js  # End-to-end startup tests
│
├── scripts/                      # Build utilities
│   ├── build-icon.js             # Generates icon from hero.png
│   └── changelog.sh              # Changelog generation script
│
├── build/                        # Build resources (icons, etc.)
│   ├── icon.ico                  # Windows app/tray icon (generated)
│   ├── icons/                    # Linux icon set (generated)
│   └── tray.png                  # System tray icon source
│
├── dist/                         # Build output (gitignored)
│   ├── win-unpacked/             # Unpacked Windows build (dev)
│   ├── gyroclopter-0.5.0.exe     # Windows NSIS installer
│   └── gyroclopter_0.5.0_amd64.deb  # Linux Debian package
│
├── package.json                  # Dependencies, scripts, electron-builder config
├── package-lock.json             # Locked dependency versions
├── playwright.config.js          # E2E test configuration
│
├── AGENTS.md                     # AI agent development guidelines
├── ARCHITECTURE.md               # Complete architecture documentation
├── RELEASE.md                    # Release process documentation
├── CHANGELOG.md                  # Version history
├── CONTRIBUTING.md               # Contribution guidelines
├── README.md                     # User documentation
└── hero.png                      # App hero image / icon source
```

---

## Security Considerations
- Server listens on `0.0.0.0:8443` with self‑signed SSL; only local‑network users should connect.
- No authentication/origin checking – treat the service as trusted LAN.
- **Never commit** real certificate files (`key.pem`, `cert.pem`).
- Secret redaction is enabled by default; keep it enabled unless debugging credentials.

---

## Known Issues & Quirks
- macOS mouse injection missing.
- macOS builds not yet configured in electron-builder.
- Keep this file under 20 000 characters (truncation limit).

---

## Contributing Checklist
1. **Fork** the repo and create a feature branch.
2. **Run** `npm test` locally; ensure all tests pass.
3. **Make** changes adhering to the style guidelines above.
4. **Run** `npm run build` and optionally test the generated installer.
5. **Commit** with a clear message and open a PR.
6. CI will enforce these rules on merge.

---

*End of AGENTS.md*