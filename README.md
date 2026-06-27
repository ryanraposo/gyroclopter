# Gyroclopter 🚁

A LAN‑based **air mouse** that lets you control a Windows (or any desktop) cursor using the gyroscope of a mobile device. The project consists of a small HTTPS server that serves a web client, a QR‑code for easy pairing, and a Windows‑specific mouse controller implemented in PowerShell.

## Table of Contents
- [Features](#features)
- [Quick Start](#quick-start)
- [Installation](#installation)
- [Usage](#usage)
- [Configuration](#configuration)
- [Testing](#testing)
- [Project Structure](#project-structure)
- [Contributing](#contributing)
- [License](#license)

## Features
- **Low‑latency mouse control** via a WebSocket connection.
- **Automatic self‑signed SSL certificate** generation so mobile browsers can access device orientation events.
- **Windows‑only mouse injection** using a lightweight PowerShell script (no native Node dependencies).
- **Terminal QR‑code** for fast pairing of a mobile device on the same LAN.
- **Cross‑platform server** (Linux/macOS/Windows) – only the mouse part is Windows‑specific.

## Quick Start
```bash
# Clone the repository (if you haven't already)
git clone https://github.com/ryanraposo/gyroclopter.git
cd gyroclopter

# Install dependencies
npm install

# Start the server
npm start
```
The server will output a QR‑code in your terminal. Scan it with your phone’s browser (same Wi‑Fi network) and accept the self‑signed certificate warning. The page will request motion sensor permission; grant it and start moving your phone to control the mouse.

## Installation
### Prerequisites
- **Node.js** (>= 14) and **npm**
- **PowerShell** (Windows) – required for the mouse controller.

```bash
# Install Node.js (example for Ubuntu)
sudo apt-get update && sudo apt-get install -y nodejs npm
```

### Install Project Dependencies
```bash
npm install
```
All required packages are listed in `package.json`:
- `qrcode` – renders a QR‑code in the terminal.
- `selfsigned` – creates placeholder SSL certificates.
- `ws` – WebSocket server.
- `jest` – testing framework (dev dependency).

## Usage
### Starting the Server
```bash
npm start
```
The server listens on **HTTPS port 8443** by default. It creates an application directory in the OS temporary folder (`/tmp/gyroclopter` on Linux) where it stores `key.pem` and `cert.pem`. You can override this directory with the `CERT_DIR` environment variable.

### Environment Variables
| Variable | Description |
|----------|-------------|
| `CERT_DIR` | Path to a directory where the SSL key and certificate will be stored. Useful for testing or custom deployments. |
| `IS_CHILD` | Internal flag used to spawn a new console window on Windows. |

### Controlling the Mouse (Windows only)
The server spawns a PowerShell child process that listens on stdin for commands:
- `MOVE <dx> <dy>` – moves the cursor.
- `LEFT_DOWN` / `LEFT_UP` – mouse button press/release.
- `CLICK_RIGHT` – right‑click.
- `SCROLL <delta>` – mouse wheel.

These commands are sent automatically by the web client based on device orientation data.

## Configuration
The default configuration lives in `server.js` under the `CONFIG` constant:
```js
const CONFIG = {
    PORT: 8443,
    APP_DIR: path.join(os.tmpdir(), 'gyroclopter'),
    MOUSE_SENSITIVITY_MULTIPLIER: 1.2
};
```
You can change these values by editing `server.js` or by setting the corresponding environment variables before launching the server.

## Testing
The project uses **Jest** for unit tests.
```bash
npm test
```
Relevant test files:
- `tests/userstories.test.js` – verifies that the application directory is created and that placeholder certificates are generated when missing.
- `tests/certificate.test.js` – checks certificate generation and reuse.
- `tests/smoke.test.js` – sanity checks for HTML extraction and temporary directory handling.

All tests should pass on a fresh clone.

## Project Structure
```
gyroclopter/
├─ server.js            # Main server entry point (exports getCertificates, ensureAppDir)
├─ client.html          # Web client served to mobile devices
├─ package.json         # npm manifest (scripts, dependencies)
├─ README.md            # <-- this file
└─ tests/
   ├─ userstories.test.js
   ├─ certificate.test.js
   └─ smoke.test.js
```

## Contributing
Contributions are welcome! Please follow these steps:
1. Fork the repository.
2. Create a new branch for your feature or bugfix.
3. Write tests for any new functionality.
4. Ensure `npm test` passes.
5. Open a pull request describing your changes.

When contributing, keep the existing coding style (CommonJS modules, 2‑space indentation) and update the documentation if you add new features.

## License
This project is licensed under the **ISC** license – see the `LICENSE` file in the repository.
