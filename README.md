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
REM ============================================================================
REM Idempotent setup for Gyroclopter on Windows.
REM Ensures git, node, and the repository are present.
REM If git or node are missing, attempts to install them via winget/chocolatey.
REM ============================================================================

:: Enable delayed expansion for variable manipulation inside blocks
setlocal EnableDelayedExpansion

:: Helper function to print error and exit
:error
echo.
echo ERROR: %~1
echo.
exit /b 1

:: --- Check and install git -------------------------------------------------
where git >nul 2>&1
if errorlevel 1 (
    echo Git not found. Attempting to install via winget...
    winget install --id Git.Git -e --silent >nul 2>&1
    if errorlevel 1 (
        echo Winget not available or failed. Trying Chocolatey...
        choco install git -y >nul 2>&1
        if errorlevel 1 (
            call :error "Git is not installed and could not be installed automatically. Please install git manually from https://git-scm.com/ and re-run this script."
        )
    )
    echo Git installed successfully.
) else (
    echo Git found.
)

:: --- Check and install node.js --------------------------------------------
where node >nul 2>&1
if errorlevel 1 (
    echo Node.js not found. Attempting to install via winget...
    winget install --id OpenJS.NodeJS -e --silent >nul 2>&1
    if errorlevel 1 (
        echo Winget not available or failed. Trying Chocolatey...
        choco install nodejs-lts -y >nul 2>&1
        if errorlevel 1 (
            call :error "Node.js is not installed and could not be installed automatically. Please install Node.js manually from https://nodejs.org/ and re-run this script."
        )
    )
    echo Node.js installed successfully.
) else (
    echo Node.js found.
)

:: --- Ensure the repository is present --------------------------------------
if not exist gyroclopter (
    echo Repository not found. Cloning...
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

:: --- Install Node dependencies ---------------------------------------------
cd gyroclopter
echo Installing Node.js dependencies...
npm install
if errorlevel 1 (
    call :error "npm install failed. Check your Node.js/npm installation."
)
echo Setup complete. You can now run 'npm run dev' to start the development server.
endlocal
```

Run it repeatedly – it will safely ensure dependencies are present and the repository is up to date.

</details>

---

## Linux

<details>
<summary>Click to expand</summary>

### Idempotent setup script (save as `setup-linux.sh`)

```bash
#!/usr/bin/env bash
set -euo pipefail

# ============================================================================
# Idempotent setup for Gyroclopter on Linux.
# Ensures git, node, and (optionally) xdotool/ydotool are present.
# If git or node are missing, attempts to install them via the distro's package manager.
# ============================================================================

# Detect package manager
if command -v apt-get &>/dev/null; then
    PKG_UPDATE="sudo apt-get update"
    PKG_INSTALL="sudo apt-get install -y"
elif command -v dnf &>/dev/null; then
    PKG_UPDATE="sudo dnf check-update"
    PKG_INSTALL="sudo dnf install -y"
elif command -v pacman &>/dev/null; then
    PKG_UPDATE="sudo pacman -Sy"
    PKG_INSTALL="sudo pacman -S --noconfirm"
else
    echo "Error: Unsupported package manager. Please install git and node manually."
    exit 1
fi

# Helper to install a package if not present
install_pkg() {
    local pkg=$1
    if ! command -v "$pkg" &>/dev/null; then
        echo "Installing $pkg..."
        $PKG_UPDATE
        $PKG_INSTALL "$pkg"
    else
        echo "$pkg already installed."
    fi
}

# --- Ensure git is installed ------------------------------------------------
install_pkg git

# --- Ensure node.js is installed -------------------------------------------
# Prefer nodejs from distro; if not available, try to install nodejs-lts from nodesource
if ! command -v node &>/dev/null; then
    echo "Node.js not found. Attempting to install..."
    $PKG_UPDATE
    # Try to install nodejs (may be older) or nodesource setup for LTS
    if command -v apt-get &>/dev/null; then
        # Ubuntu/Debian: install nodejs and npm
        $PKG_INSTALL nodejs npm
    elif command -v dnf &>/dev/null; then
        $PKG_INSTALL nodejs npm
    elif command -v pacman &>/dev/null; then
        $PKG_INSTALL nodejs npm
    fi
    # Verify node is now available
    if ! command -v node &>/dev/null; then
        echo "Error: Failed to install node.js. Please install it manually and re-run this script."
        exit 1
    fi
fi
echo "Node.js version: $(node --version)"

# --- Optional: ensure mouse tool is installed based on session type ---------
if [[ "${XDG_SESSION_TYPE:-}" == "x11" ]]; then
    install_pkg xdotool
elif [[ "${XDG_SESSION_TYPE:-}" == "wayland" ]]; then
    install_pkg ydotool
else
    echo "Warning: Could not determine session type (XDG_SESSION_TYPE not set). Mouse tools may be needed."
fi

# --- Ensure the repository is present ---------------------------------------
REPO_DIR="gyroclopter"
REPO_URL="https://github.com/ryanraposo/gyroclopter.git"

if [[ ! -d "$REPO_DIR" ]]; then
    echo "Cloning repository..."
    git clone "$REPO_URL" "$REPO_DIR"
else
    echo "Updating repository..."
    cd "$REPO_DIR"
    git pull
    cd ..
fi

# --- Install Node dependencies ---------------------------------------------
cd "$REPO_DIR"
echo "Installing Node.js dependencies..."
npm install
cd ..

echo
echo "Setup complete. You can now run:"
echo "  cd $REPO_DIR && npm run dev"
echo
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
set -euo pipefail

# ============================================================================
# Idempotent setup for Gyroclopter on macOS.
# Ensures git, node, and (optionally) mouse tools are present.
# If git or node are missing, attempts to install them via Homebrew.
# ============================================================================

# Check for Homebrew and install if missing
if ! command -v brew &>/dev/null; then
    echo "Homebrew not found. Installing Homebrew..."
    /bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
    # Add Homebrew to PATH for this session (Apple Silicon and Intel paths)
    echo 'eval "$(/opt/homebrew/bin/bash --shell)"' >> ~/.zprofile
    eval "$(/opt/homebrew/bin/brew shellenv)"
fi

# Update Homebrew
echo "Updating Homebrew..."
brew update

# --- Ensure git is installed ------------------------------------------------
if ! command -v git &>/dev/null; then
    echo "Installing git..."
    brew install git
else
    echo "git already installed."
fi

# --- Ensure node.js is installed -------------------------------------------
if ! command -v node &>/dev/null; then
    echo "Installing Node.js..."
    brew install node
else
    echo "Node.js already installed: $(node --version)"
fi

# --- Optional: note about mouse tools on macOS ------------------------------
echo "Note: Mouse injection is not yet implemented on macOS."
echo "If you wish to contribute, consider adding ydotool-equivalent support."

# --- Ensure the repository is present ---------------------------------------
REPO_DIR="gyroclopter"
REPO_URL="https://github.com/ryanraposo/gyroclopter.git"

if [[ ! -d "$REPO_DIR" ]]; then
    echo "Cloning repository..."
    git clone "$REPO_URL" "$REPO_DIR"
else
    echo "Updating repository..."
    cd "$REPO_DIR"
    git pull
    cd ..
fi

# --- Install Node dependencies ---------------------------------------------
cd "$REPO_DIR"
echo "Installing Node.js dependencies..."
npm install
cd ..

echo
echo "Setup complete. You can now run:"
echo "  cd $REPO_DIR && npm run dev"
echo
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

A QR code appears in the terminal. Scan it with your phone, accept the self‑signed certificate warning, grant motion permission, and calibrate. You’re now controlling the mouse.

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