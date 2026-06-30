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

## Code Style Guidelines
- **CommonJS** (`require` / `module.exports`).
- Indentation: **2 spaces**.
- Prefer modern JavaScript/TypeScript where appropriate.
- Use the provided `logger` utility instead of `console.log` in production.
- JSDoc‑style block comments for functions and classes.
- Async/await for asynchronous operations (e.g., certificate generation).

---

## Runtime Architecture (Reference)
- **Electron** provides the desktop UI and spawns the embedded server binary.
- The server emits JSON lines on `stdout` and handles HTTPS/WSS.
- Mouse injection varies by platform:
  - Windows: PowerShell + `user32.dll`.
  - Linux (X11): `xdotool`.
  - Linux (Wayland): `ydotool`.
  - macOS: **Not yet implemented** – avoid adding macOS mouse controls.
- SSL certificates are self‑signed and generated at runtime in the OS temporary directory (or `CERT_DIR` if set).

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