<br/>
<div align="center">
  <a href="" rel="noopener">
  <img width=300px src="./gc.png" alt="gyroclopter"></a>
</div>
<br/>
<div align="center">

  # Gyroclopter

  Point your phone, and then point your phone.
  
  [![LoveIt;ShipIt](https://gitlab.com/ryanraposo/LoveItShipIt/-/raw/master/sticker/loveitshipit.svg)](http://github.com/ryanraposo/LoveItShipIt)
  
</div>


## Windows

The following batch script sets up the development environment on Windows, ensuring Git and Node.js are installed, cloning or updating the repository, and installing npm dependencies. It can be re‑run safely at any time. It also starts the Gyroclopter server after setup.

<details>
<summary>Click to expand</summary>

```bat
@echo off
REM ============================================================================
REM Idempotent setup for Gyroclopter on Windows.
REM Ensures git and node are present, and the repository is available.
REM If git is missing, downloads the repository as a ZIP file.
REM If node is missing, exits with instructions to install it manually.
REM ============================================================================

setlocal EnableDelayedExpansion

:: Helper to print error and exit
:error
echo.
echo ERROR: %~1
echo.
exit /b 1

:: --- Check for git ---------------------------------------------------------
where git >nul 2>&1
if errorlevel 1 (
    echo Git not found. Attempting to download repository as ZIP...
    :: Use PowerShell to download and extract the ZIP
    powershell -NoProfile -Command "& {
        \$ErrorActionPreference = 'Stop';
        \$zipPath = '%TEMP%\gyroclopter.zip';
        \$url = 'https://github.com/ryanraposo/gyroclopter/archive/refs/heads/main.zip';
        try {
            Invoke-WebRequest -Uri \$url -OutFile \$zipPath -UseBasicParsing;
            Expand-Archive -Path \$zipPath -DestinationPath '%TEMP%\gyroclopter-temp' -Force;
            Move -Path '%TEMP%\gyroclopter-temp\gyroclopter-main' -Destination 'gyroclopter' -Force;
            Remove-Item \$zipPath -Force;
            Remove-Item -Recurse -Force '%TEMP%\gyroclopter-temp';
            Write-Host 'Repository downloaded and extracted successfully.';
        } catch {
            Write-Error 'Failed to download or extract repository.';
            exit 1;
        }
    }"
    if errorlevel 1 (
        call :error "Failed to download repository. Please install git manually from https://git-scm.com/ and re-run this script."
    )
) else (
    echo Git found.
)

:: --- Check for node ---------------------------------------------------------
where node >nul 2>&1
if errorlevel 1 (
    call :error "Node.js is not installed. Please install Node.js from https://nodejs.org/ and re-run this script."
) else (
    echo Node.js found.
)

:: --- Ensure repository is present (if not already extracted) -----------------
if not exist gyroclopter (
    echo Repository not found after git/check. Cloning via git...
    git clone https://github.com/ryanraposo/gyroclopter.git
    if errorlevel 1 (
        call :error "Failed to clone repository. Check your internet connection and git installation."
    )
) else (
    echo Repository found. Updating...
    cd gyroclopter
    git pull
    if errorlevel 1 (
        call :error "Failed to pull updates. You may have local conflicts; consider stashing or resetting."
    )
    cd ..
)

:: --- Install Node dependencies ----------------------------------------------
cd gyroclopter
echo Installing Node.js dependencies...
npm install
if errorlevel 1 (
    call :error "npm install failed. Check your Node.js/npm installation."
)
echo Setup complete. You can now run 'npm run dev' to start the development server.

echo Starting Gyroclopter server...
npm start
endlocal
```

Run it repeatedly – it will safely ensure dependencies are present and the repository is up to date.

</details>

---

## Linux

The following Bash script prepares a Linux development environment, ensuring Git and Node.js are installed, checking for required mouse‑control tools, cloning or updating the repository, and installing npm dependencies. It can be safely re‑run. It also starts the Gyroclopter server after setup.

<details>
<summary>Click to expand</summary>

```bash
#!/usr/bin/env bash
set -euo pipefail

# ============================================================================
# Idempotent setup for Gyroclopter on Linux.
# Ensures git and node are present, and the repository is available.
// If git is missing, downloads the repository as a ZIP file.
// If node is missing, exits with instructions to install it manually.
// ============================================================================

# Helper to print error and exit
error() {
    echo "Error: $1" >&2
    exit 1
}

# --- Check for git -----------------------------------------------------------
if ! command -v git &>/dev/null; then
    echo "Git not found. Attempting to download repository as ZIP..."
    # Determine which downloader is available
    if command -v curl &>/dev/null; then
        DOWNLOAD_CMD="curl -L -o"
    elif command -v wget &>/dev/null; then
        DOWNLOAD_CMD="wget -O"
    else
        error "Neither curl nor wget is available. Please install git or one of curl/wget to download the repository."
    fi
    ZIP_FILE="$(mktemp).zip"
    REPO_URL="https://github.com/ryanraposo/gyroclopter/archive/refs/heads/main.zip"
    $DOWNLOAD_CMD "$ZIP_FILE" "$REPO_URL" || error "Failed to download repository ZIP."
    # Unzip
    if command -v unzip &>/dev/null; then
        unzip -q "$ZIP_FILE" -d "$(dirname "$ZIP_FILE")" || error "Failed to extract ZIP."
        mv "$(dirname "$ZIP_FILE")/gyroclopter-main" gyroclopter || error "Failed to rename extracted directory."
    else
        error "unzip is required to extract the repository ZIP. Please install unzip."
    fi
    rm -f "$ZIP_FILE"
    echo "Repository downloaded and extracted successfully."
else
    echo "Git found."
fi

# --- Check for node ----------------------------------------------------------
if ! command -v node &>/dev/null; then
    error "Node.js is not installed. Please install Node.js from https://nodejs.org/ and re-run this script."
else
    echo "Node.js version: $(node --version)"
fi

# --- Optional: check for mouse tools based on session type -------------------
if [[ "${XDG_SESSION_TYPE:-}" == "x11" ]]; then
    if ! command -v xdotool &>/dev/null; then
        echo "Warning: xdotool not installed. Install it for mouse support: sudo apt install xdotool"
    fi
elif [[ "${XDG_SESSION_TYPE:-}" == "wayland" ]]; then
    if ! command -v ydotool &>/dev/null; then
        echo "Warning: ydotool not installed. Install it for mouse support: sudo apt install ydotool"
    fi
else
    echo "Warning: Could not determine session type (XDG_SESSION_TYPE not set). Mouse tools may be needed."
fi

# --- Ensure repository is present (if not already extracted) -----------------
REPO_DIR="gyroclopter"
REPO_URL="https://github.com/ryanraposo/gyroclopter.git"

if [[ ! -d "$REPO_DIR" ]]; then
    echo "Repository not found. Cloning via git..."
    git clone "$REPO_URL" "$REPO_DIR" || error "Failed to clone repository."
else
    echo "Updating repository..."
    cd "$REPO_DIR"
    git pull || error "Failed to pull updates."
    cd ..
fi

# --- Install Node dependencies -----------------------------------------------
cd "$REPO_DIR"
echo "Installing Node.js dependencies..."
npm install || error "npm install failed."
cd ..

echo
echo "Setup complete. You can now run:"
echo "  cd $REPO_DIR && npm run dev"
echo

echo "Starting Gyroclopter server..."
npm start
```

Make it executable (`chmod +x setup-linux.sh`) and run it anytime.

</details>

---

## macOS

The following Bash script sets up the development environment on macOS, verifying Git and Node.js, cloning or updating the repository, and installing npm dependencies. It also notes that mouse injection is not yet implemented on macOS. The script is idempotent and can be re‑run safely. It also starts the Gyroclopter server after setup.

<details>
<summary>Click to expand</summary>

### Idempotent setup script (save as `setup-mac.sh`)

```bash
#!/usr/bin/env bash
set -euo pipefail

# ============================================================================
# Idempotent setup for Gyroclopter on macOS.
// Ensures git and node are present, and the repository is available.
// If git is missing, downloads the repository as a ZIP file.
// If node is missing, exits with instructions to install it manually.
// ============================================================================

# Helper to print error and exit
error() {
    echo "Error: $1" >&2
    exit 1
}

# --- Check for git -----------------------------------------------------------
if ! command -v git &>/dev/null; then
    echo "Git not found. Attempting to download repository as ZIP..."
    if ! command -v curl &>/dev/null; then
        error "curl is required to download the repository ZIP. Please install curl or git."
    fi
    ZIP_FILE="$(mktemp).zip"
    REPO_URL="https://github.com/ryanraposo/gyroclopter/archive/refs/heads/main.zip"
    curl -L -o "$ZIP_FILE" "$REPO_URL" || error "Failed to download repository ZIP."
    if ! command -v unzip &>/dev/null; then
        error "unzip is required to extract the repository ZIP. Please install unzip."
    fi
    unzip -q "$ZIP_FILE" -d "$(dirname "$ZIP_FILE")" || error "Failed to extract ZIP."
    mv "$(dirname "$ZIP_FILE")/gyroclopter-main" gyroclopter || error "Failed to rename extracted directory."
    rm -f "$ZIP_FILE"
    echo "Repository downloaded and extracted successfully."
else
    echo "Git found."
fi

# --- Check for node ----------------------------------------------------------
if ! command -v node &>/dev/null; then
    error "Node.js is not installed. Please install Node.js from https://nodejs.org/ and re-run this script."
else
    echo "Node.js version: $(node --version)"
fi

# --- Optional: note about mouse tools on macOS -------------------------------
echo "Note: Mouse injection is not yet implemented on macOS."
echo "If you wish to contribute, consider adding ydotool-equivalent support."

# --- Ensure repository is present (if not already extracted) -----------------
REPO_DIR="gyroclopter"
REPO_URL="https://github.com/ryanraposo/gyroclopter.git"

if [[ ! -d "$REPO_DIR" ]]; then
    echo "Repository not found. Cloning via git..."
    git clone "$REPO_URL" "$REPO_DIR" || error "Failed to clone repository."
else
    echo "Updating repository..."
    cd "$REPO_DIR"
    git pull || error "Failed to pull updates."
    cd ..
fi

# --- Install Node dependencies -----------------------------------------------
cd "$REPO_DIR"
echo "Installing Node.js dependencies..."
npm install || error "npm install failed."
cd ..

echo
echo "Setup complete. You can now run:"
echo "  cd $REPO_DIR && npm run dev"
echo

echo "Starting Gyroclopter server..."
npm start
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

A QR code appears in the terminal. Scan it with your phone, accept the self‑signed certificate warning, grant motion permission, and calibrate. You're now controlling the mouse.

### Build a distributable

```bash
# Windows: produces dist\gyroclopter-setup-<version>.exe (requires makensis.exe).
# Linux:   produces dist/gyroclopter_<version>_amd64.deb (requires dpkg-deb).
# macOS:   produces a Neutralino app in dist/ (requires packaging tools).
npm run build
```

Then platform‑specific installers:

- **Windows:** `npm run build:win-installer`
- **Linux:**   `npm run build:deb`
- **macOS:**   `npm run build:desktop` (produces macOS app in `dist/`)

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