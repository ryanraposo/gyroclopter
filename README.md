# Gyroclopter 🚁

Turn your phone into a wireless gyroscopic air mouse for your desktop.

Gyroclopter runs a tiny HTTPS/WebSocket server on your computer and serves a full-screen mobile web client. Point your phone at the screen, tilt to steer, tap to click, and swipe to scroll — no app store installs required.

![Gyroclopter icon](build/icon-source.png =100x100) [![loveitshipit](https://img.shields.io/badge/loveitshipit-ryanraposo-blue)](https://github.com/ryanraposo/loveitshipit)

---

## Windows

<details>
<summary>Click to expand</summary>

### Idempotent setup script (save as `setup-windows.bat`)

```bat
@echo off
REM Idempotent setup for Gyroclopter on Windows: ensures git, node, and the repo are present.
where git >nul 2>&1 || (
    echo Error: git is not installed. Please install git from https://git-scm.com/
    exit /b 1
)
where node >nul 2>&1 || (
    echo Error: node.js is not installed. Please install node.js from https://nodejs.org/
    exit /b 1
)
if not exist gyroclopter (
    git clone https://github.com/ryanraposo/gyroclopter.git
    cd gyroclopter
) else (
    cd gyroclopter
    git pull
)
npm install
REM Optional: install xdotool/ydotool equivalents? On Windows not needed.
REM For mouse injection, PowerShell is built-in.
```
Run it repeatedly – it will safely update and ensure dependencies.

</details>

---

## Linux

<details>
<summary>Click to expand</summary>

### Idempotent setup script (save as `setup-linux.sh`)

```bash
#!/usr/bin/env bash
set -e
# Ensure git, node, and (for mouse) xdotool or ydotool are available
if ! command -v git &> /dev/null; then
    echo "Error: git is not installed. Please install git (e.g., sudo apt install git)"
    exit 1
fi
if ! command -v node &> /dev/null; then
    echo "Error: node.js is not installed. Please install node.js (e.g., sudo apt install nodejs)"
    exit 1
fi
# Optional: check for xdotool or ydotool based on session type
if [ "$XDG_SESSION_TYPE" = "x11" ]; then
    if ! command -v xdotool &> /dev/null; then
        echo "Warning: xdotool not installed. Install for mouse support: sudo apt install xdotool"
    fi
elif [ "$XDG_SESSION_TYPE" = "wayland" ]; then
    if ! command -v ydotool &> /dev/null; then
        echo "Warning: ydotool not installed. Install for mouse support: sudo apt install ydotool"
    fi
fi
if [ ! -d gyroclopter ]; then
    git clone https://github.com/ryanraposo/gyroclopter.git
    cd gyroclopter
else
    cd gyroclopter
    git pull
fi
npm install
```
Make it executable (`chmod +x setup-linux.sh`) and run it anytime.

</details>

---

## macOS

<details>
<summary>Click to expand</summary>

### Idempotent setup script (save as `setup-mac.sh`)

```bash
#!/usr/bin/env bash
set -e
# Ensure git and node are available
if ! command -v git &> /dev/null; then
    echo "Error: git is not installed. Please install git (e.g., brew install git)"
    exit 1
fi
if ! command -v node &> /dev/null; then
    echo "Error: node.js is not installed. Please install node.js (e.g., brew install node)"
    exit 1
fi
# Note: Mouse injection not yet implemented on macOS.
if [ ! -d gyroclopter ]; then
    git clone https://github.com/ryanraposo/gyroclopter.git
    cd gyroclopter
else
    cd gyroclopter
    git pull
fi
npm install
```
Make it executable (`chmod +x setup-mac.sh`) and run it anytime.

</details>

---

## Development

### Quick start (dev)

```bash
# Clone the repository
git clone https://github.com/ryanraposo/gyroclopter.git
cd gyroclopter

# Install dependencies
npm install

# Start the server
npm run dev
```

A QR code appears in the terminal. Scan it with your phone, accept the self-signed certificate warning, grant motion permission, and calibrate. You’re now controlling the mouse.

### Build a distributable

```bash
# Windows: produces dist\gyroclopter-setup-<version>.exe (requires makensis.exe).
# Linux:   produces dist/gyroclopter_<version>_amd64.deb (requires dpkg-deb).
# macOS:   produces a Neutralino app in dist/ (requires packaging tools).
npm run build
```

Then platform‑specific installers:

- **Windows:** `npm run build:win-installer`
- **Linux:** `npm run build:deb`
- **macOS:** `npm run build:desktop` (produces macOS app in `dist/`)

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
- **Linux mouse doesn’t move** – Install `xdotool` (X11) or `ydotool` (Wayland` and check `$XDG_SESSION_TYPE`.

---

## (Wayland) and check `$XDG_SESSION_TYPE`.

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