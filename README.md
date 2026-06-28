# Gyroclopter 🚁

Turn your phone into a wireless gyroscopic air mouse for your desktop.

Gyroclopter runs a tiny HTTPS/WebSocket server on your computer and serves a full-screen mobile web client. Point your phone at the screen, tilt to steer, tap to click, and swipe to scroll — no app store installs required.

---

## Table of Contents

- [Features](#features)
- [Quick Start](#quick-start)
- [Requirements](#requirements)
- [Installation](#installation)
- [Usage](#usage)
- [Mobile Controls](#mobile-controls)
- [Configuration](#configuration)
- [Troubleshooting](#troubleshooting)
- [Testing](#testing)
- [Project Structure](#project-structure)
- [Contributing](#contributing)
- [License](#license)

---

## Features

- **Gyroscopic air mouse** — control the cursor by tilting your phone.
- **Zero-install mobile client** — works in any modern mobile browser.
- **Low-latency WebSocket** connection between phone and desktop.
- **Automatic self-signed SSL certificates** so iOS/Android browsers allow motion sensor access over HTTPS.
- **Native desktop app** — dedicated window with QR code, server status, and system tray.
- **Cross-platform server** — runs on Windows, Linux, and macOS.
- **Native mouse injection**:
  - Windows: PowerShell with P/Invoke (no extra dependencies).
  - Linux: `xdotool` (X11) or `ydotool` (Wayland).
- **On-device calibration** and adjustable sensitivity.

---

## Quick Start

```bash
# Clone the repository
git clone https://github.com/ryanraposo/gyroclopter.git
cd gyroclopter

# Install dependencies
npm install

# Start the server
npm start
```

A QR code appears in the terminal. Scan it with your phone, accept the self-signed certificate warning, grant motion permission, and calibrate. You’re now controlling the mouse.

---

## Requirements

### Server (desktop)

- Same Wi-Fi network as your phone
- **Windows**: Webview2 (built-in on Windows 10+)
- **Linux**: WebKitGTK (`webkit2gtk-4.0`)

### Mouse control

| Platform | Requirement |
|----------|-------------|
| Windows  | PowerShell (built-in) |
| Linux    | `xdotool` for X11 or `ydotool` for Wayland |
| macOS    | Server runs; mouse injection not yet implemented |

Install the Linux tools on Ubuntu/Debian with:

```bash
sudo apt update
sudo apt install xdotool        # X11
# or
sudo apt install ydotool        # Wayland
```

### Client (mobile)

- A modern mobile browser
- HTTPS access (required for `devicemotion` events)
- Motion sensor permission

---

## Installation

### From a release

Download the latest artifact for your platform from the [GitHub Releases](../../releases) page:

- **Windows**: `gyroclopter-setup-<version>.exe` — NSIS installer. Run it and follow the prompts.
- **Linux (Debian/Ubuntu)**: `gyroclopter_<version>_amd64.deb` — install with `sudo dpkg -i gyroclopter_<version>_amd64.deb`.

### From source

```bash
npm install
```

Dependencies are listed in `package.json`:

| Package              | Purpose                                        |
|----------------------|------------------------------------------------|
| `selfsigned`         | Generate self-signed SSL certificates          |
| `ws`                 | WebSocket server                               |
| `@neutralinojs/neu`  | Neutralino build tool (dev dependency)          |
| `jest`               | Test framework (dev dependency)                |
| `@yao-pkg/pkg`       | Single-file binary packaging (dev)             |
| `pngjs`              | Pure-JS PNG/ICO generation (dev)               |

### Build a distributable

```bash
# Windows: produces dist\gyroclopter-setup-<version>.exe (requires makensis.exe).
# Linux:   produces dist/gyroclopter_<version>_amd64.deb (requires dpkg-deb).
npm run build
```

---

## Usage

### Run the desktop app

```bash
npm run dev
```

Or run the packaged `gyroclopter.exe` directly.

### Pair your phone

1. Launch **Gyroclopter**.
2. Click **Start Server**.
3. A QR code appears in the app window — or take note of the URL shown below it.
4. Connect your phone to the same Wi-Fi network.
5. Scan the QR code or open the URL in your mobile browser.
6. Accept the self-signed certificate warning.
7. Tap **Allow & Connect** and grant motion access if prompted.
8. Tap **Calibrate** while pointing your phone at the cursor.

### Stop the server

Click **Stop Server** in the app, or close the window (minimizes to tray) and choose **Quit** from the tray menu.

---

## Mobile Controls

| Control            | Action                                            |
|--------------------|---------------------------------------------------|
| Tilt phone         | Move the cursor                                   |
| Tap main pad       | Toggle motion control on/off                      |
| Hold **LEFT**      | Left mouse button down/up                         |
| Tap **RIGHT**      | Right-click                                       |
| Swipe **SCROLL**   | Scroll wheel up/down                              |
| Sensitivity slider | Adjust cursor speed (1–25)                        |

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

| Environment Variable | Description |
|----------------------|-------------|
| `CERT_DIR`           | Directory where `key.pem` and `cert.pem` are stored. Defaults to the OS temp directory. |
| `IS_CHILD`           | Internal flag used to spawn a visible console window on Windows. |

---

## Troubleshooting

### Phone can’t reach the server

- Make sure both devices are on the same local network.
- Check that a firewall is not blocking port `8443`.
- Try navigating to the URL manually instead of scanning the QR code.

### Motion permission is denied

- iOS requires HTTPS and an explicit user gesture to request `devicemotion` access.
- Ensure you tapped **Allow & Connect** and granted permission when the browser asked.

### Self-signed certificate warning

This is expected. Mobile browsers require HTTPS for motion sensors, so Gyroclopter generates a local certificate. You can safely proceed past the warning.

### Linux mouse doesn’t move

- Verify you installed `xdotool` (X11) or `ydotool` (Wayland).
- Check your session type: `echo $XDG_SESSION_TYPE`.

---

## Testing

```bash
npm test
```

Test files:

- `tests/certificate.test.js` — certificate generation and reuse
- `tests/userstories.test.js` — WebSocket command flow
- `tests/smoke.test.js` — server smoke tests
- `tests/dummy.test.js` — utility functions

---

## Project Structure

```
gyroclopter/
├── server/                   # Headless server source (compiled with pkg)
│   ├── server.js             # HTTPS/WebSocket server and mouse controllers
│   ├── client.html           # Mobile web client (served to phone)
│   ├── pkg.config.cjs        # @yao-pkg/pkg configuration
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

Contributions are welcome.

1. Fork the repository.
2. Create a branch for your feature or bug fix.
3. Add tests for new functionality.
4. Make sure `npm test` passes.
5. Open a pull request describing the change.

Please follow the existing style: CommonJS modules, 2-space indentation, and clear commit messages.

---

## License

This project is licensed under the [ISC License](https://opensource.org/licenses/ISC).
