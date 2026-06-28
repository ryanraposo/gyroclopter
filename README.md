# Gyroclopter 🚁

Turn your phone into a wireless gyroscopic air mouse for your desktop.

Gyroclopter runs a tiny HTTPS/WebSocket server on your computer and serves a full-screen mobile web client. Point your phone at the screen, tilt to steer, tap to click, and swipe to scroll — no app store installs required.

![Gyroclopter icon](build/icon-source.png =100x100) [![loveitshipit](https://img.shields.io/badge/loveitshipit-ryanraposo-blue)](https://github.com/ryanraposo/loveitshipit)

---

## Windows

<details>
<summary>Click to expand</summary>

### Quick start (dev)

```bat
git clone https://github.com/ryanraposo/gyroclopter.git
cd gyroclopter
npm install
npm run dev
```

### Idempotent batch script (save as `setup-windows.bat`)

```bat
@echo off
REM Idempotent setup for Gyroclopter on Windows
if not exist gyroclopter (
    git clone https://github.com/ryanraposo/gyroclopter.git
    cd gyroclopter
) else (
    cd gyroclopter
    git pull
)
npm install
npm run dev
```
Run it repeatedly – it will safely update and restart the dev server.

### Build installer

```bat
npm run build
npm run build:win-installer
```
The NSIS installer will appear in `dist/gyroclopter-setup-<version>.exe`.

</details>

---

## Linux

<details>
<summary>Click to expand</summary>

### Quick start (dev)

```bash
git clone https://github.com/ryanraposo/gyroclopter.git
cd gyroclopter
npm install
npm run dev
```

### Idempotent shell script (save as `setup-linux.sh`)

```bash
#!/usr/bin/env bash
set -e
if [ ! -d gyroclopter ]; then
    git clone https://github.com/ryanraposo/gyroclopter.git
    cd gyroclopter
else
    cd gyroclopter
    git pull
fi
npm install
npm run dev
```
Make it executable (`chmod +x setup-linux.sh`) and run it anytime.

### Build Debian package

```bash
npm run build
npm run build:deb
```
The `.deb` file will appear in `dist/gyroclopter_<version>_amd64.deb`.

</details>

---

## macOS

<details>
<summary>Click to expand</summary>

### Quick start (dev)

```bash
git clone https://github.com/ryanraposo/gyroclopter.git
cd gyroclopter
npm install
npm run dev
```

### Idempotent shell script (save as `setup-mac.sh`)

```bash
#!/usr/bin/env bash
set -e
if [ ! -d gyroclopter ]; then
    git clone https://github.com/ryanraposo/gyroclopter.git
    cd gyroclopter
else
    cd gyroclopter
    git pull
fi
npm install
npm run dev
```
Make it executable (`chmod +x setup-mac.sh`) and run it anytime.

### Build macOS app (requires Neutralino packaging)

```bash
npm run build
npm run build:desktop   # produces macOS app in dist/
```
Note: Mouse injection is not yet implemented on macOS.

</details>

---

## Usage (all platforms)

1. Launch Gyroclopter (via `npm run dev` or the packaged binary).
2. Click **Start Server**.
3. Scan the QR code with your phone or open the shown URL.
4. Accept the self‑signed certificate warning.
5. Tap **Allow & Connect** and grant motion access.
6. Tap **Calibrate** while pointing your phone at the cursor.
7. Use the pad to move, tap/hold for clicks, swipe to scroll, and adjust sensitivity.

Close the window to tray‑icon; quit from the tray to stop the server.

---

## Mobile Controls

| Control            | Action                                            |
|--------------------|---------------------------------------------------|
| Tilt phone         | Move the cursor                                   |
| Tap main pad       | Toggle motion control on/off                      |
| Hold **LEFT**      | Left mouse button down/up                         |
| Tap **RIGHT**      | Right‑click                                       |
| Swipe **SCROLL**   | Scroll wheel up/down                              |
| Sensitivity slider | Adjust cursor speed (1‑25)                        |

---

## Configuration

Default settings live in `server.js`:

```js
const CONFIG = {
    PORT: 8443,
    APP_DIR: path.join(os.tmpdir(), 'gyroclopter'),
    MOUSE_SENSITIVITY_MULTIPLIER: 1.2
};
```

| Environment Variable | Description                                                            |
|----------------------|------------------------------------------------------------------------|
| `CERT_DIR`           | Directory for `key.pem` and `cert.pem`. Defaults to OS temp directory. |
| `IS_CHILD`           | Internal flag to spawn a visible console window on Windows.            |

---

## Troubleshooting

- **Phone can’t reach the server** – Ensure both devices are on the same Wi‑Fi and port 8443 isn’t blocked.
- **Motion permission denied** – On iOS you must tap **Allow & Connect** and grant permission when prompted.
- **Self‑signed certificate warning** – Expected; mobile browsers require HTTPS for `devicemotion`. Proceed safely.
- **Linux mouse doesn’t move** – Install `xdotool` (X11) or `ydotool` (Wayland) and check `$XDG_SESSION_TYPE`.

---

## Testing

```bash
npm test
```
Runs the Jest test suite in `server/tests/`.

---

## Project Structure

```
gyroclopter/
├── server/                   # Headless server source (compiled with pkg)
│   ├── server.js             # HTTPS/WSS server + mouse controllers
│   ├── client.html           # Mobile web client
│   ├── pkg.config.cjs        # @yao-pkg/pkg config
│   └── tests/                # Jest test suite
├── desktop/                  # Neutralino desktop app source
│   └── src/                  # UI source (copied to resources at build)
│       ├── index.html
│       ├── main.js
│       └── style.css
├── scripts/                  # Build tooling
│   ├── build-binary.js       # @yao-pkg/pkg wrapper → server binary
│   ├── build-desktop.js      # Neutralino build → desktop binary
│   ├── build-icon.js         # PNG → ICO generator
│   ├── build-installer-nsi.js# Drives makensis
│   └── build-deb.js          # dpkg-deb assembler
├── neutralino.config.json    # Neutralinojs project config
├── installer.nsi             # NSIS installer script (Windows)
└── package.json              # npm manifest
```

---

## Contributing

1. Fork the repository.
2. Create a branch for your feature or bug fix.
3. Add tests for new functionality.
4. Ensure `npm test` passes.
5. Open a pull request describing the change.

Follow the existing style: CommonJS modules, 2‑space indentation, clear commit messages.

---

## License

This project is licensed under the [ISC License](https://opensource.org/licenses/ISC).