# Gyroclopter Application Architecture Map

**Generated:** July 1, 2026  
**Version:** 0.5.0  
**Type:** Electron Desktop App + Headless Server

---

## 📋 Overview

Gyroclopter is a wireless gyroscopic air mouse system consisting of:
1. **Electron desktop application** (Windows/Linux) - manages UI and server lifecycle
2. **HTTPS/WSS server** - serves client HTML and handles WebSocket commands
3. **Mobile web client** - captures device motion and sends mouse commands over LAN

---

## 🏗️ High-Level Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                     Electron Desktop App                        │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────────────┐  │
│  │  Main Proc   │  │   Preload    │  │   Renderer (UI)      │  │
│  │  (IPC +      │◄─┤   (Bridge)   ├─►│   - QR Display       │  │
│  │   Tray)      │  │              │  │   - Status/Controls  │  │
│  └──────┬───────┘  └──────────────┘  └──────────────────────┘  │
│         │                                                       │
│         ▼                                                       │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │           server.js (spawned as child process)            │   │
│  │  ┌────────────┐  ┌──────────────┐  ┌─────────────────┐   │   │
│  │  │ HTTPS Svr  │  │ WebSocket Svr│  │ Mouse Controller│   │   │
│  │  │ :8443      │◄─┤  (WSS)       │◄─┤  - Windows: P/   │   │   │
│  │  │            │  │              │  │    Invoke        │   │   │
│  │  └────────────┘  └──────┬───────┘  │  - Linux: xdotool│   │   │
│  │                         │          │    /ydotool      │   │   │
│  └─────────────────────────┼──────────┴──────────────────┘   │   │
│                           │                                   │
└───────────────────────────┼───────────────────────────────────┘
                            │ LAN (WiFi)
                            │ HTTPS/WSS
                            ▼
                ┌─────────────────────────┐
                │   Mobile Web Client     │
                │  (client.html in.browser)│
                │  - DeviceMotion sensor  │
                │  - Touch controls       │
                │  - WebSocket commands   │
                └─────────────────────────┘
```

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
├── dist/                         # Output: .exe and .deb installers
│
├── package.json                  # Dependencies, scripts, electron-builder config
├── AGENTS.md                     # AI agent development guidelines
├── RELEASE.md                    # Release process documentation
├── CHANGELOG.md                  # Version history
├── CONTRIBUTING.md               # Contribution guidelines
└── README.md                     # User documentation
```

---

## 🔌 Core Components

### 1. Electron Main Process (`app/electron-main.js`)

**Responsibilities:**
- Creates system tray icon with context menu
- Manages BrowserWindow (400x600, non-resizable)
- Spawns `server.js` as child process (`node server.js`)
- Handles IPC communication between renderer and server
- Parses JSON status lines from server stdout
- Auto-starts server on window ready
- Minimizes to tray on close (doesn't quit)

**Key State:**
```javascript
STATE = {
  serverPid: null,
  running: false,
  connectedCount: 0,
  tray: null,
  serverProcess: null  // ChildProcess
}
```

**IPC Channels:**
- `start-server` → triggers server spawn
- `stop-server` → kills server process
- `server-event` → sends JSON status to renderer
- `server-exit` → notifies renderer of server death

**Lifecycle:**
1. App ready → create tray + window
2. Window ready → call `startServer()`
3. Spawn `node [server.js]` with piped stdio
4. Listen to stdout for JSON events (`started`, `connection`, `disconnection`, `stopped`, `error`)
5. Forward events to renderer via `webContents.send()`
6. On window close → hide (don't quit), server keeps running
7. On quit → stop server, exit

---

### 2. Preload Script (`app/preload.js`)

**Purpose:** Secure IPC bridge using Context Bridge API

**Exposed API:**
```javascript
window.electronAPI = {
  startServer: () => ipcRenderer.send('start-server'),
  stopServer: () => ipcRenderer.send('stop-server'),
  onServerEvent: (callback) => ipcRenderer.on('server-event', callback),
  onServerExit: (callback) => ipcRenderer.on('server-exit', callback)
}
```

**Security:**
- `contextIsolation: true`
- `nodeIntegration: false`
- Renderer cannot directly access Node.js APIs

---

### 3. Renderer (`app/renderer.js`)

**Responsibilities:**
- Updates UI based on server state
- Displays QR code and connection URL
- Shows connection count
- Handles start/stop button clicks
- Listens for server events from main process

**State:**
```javascript
STATE = {
  serverPid: null,
  running: false,
  connectedCount: 0
}
```

**Event Handling:**
- `started` → show QR, update status to "Running"
- `connection`/`disconnection` → update connected count
- `stopped` → reset UI to "Stopped"
- `error` → display error message

---

### 4. Server (`server.js`)

**The Core Engine** - 530 lines

#### Configuration
```javascript
CONFIG = {
  PORT: 8443,
  APP_DIR: path.join(os.tmpdir(), 'gyroclopter'),
  MOUSE_SENSITIVITY_MULTIPLIER: 1.2
}
```

#### Key Features:

**A. Self-Signed SSL Certificates**
- Generated at runtime using `selfsigned` library
- Stored in OS temp dir (`/tmp/gyroclopter/` on Linux)
- Valid for 365 days
- Reused if valid PEM files exist
- Overridable via `CERT_DIR` env variable

**B. HTTPS Server**
- Listens on `0.0.0.0:8443`
- Serves `client.html` for all requests
- Cached in memory after first read

**C. WebSocket Server**
- Upgraded HTTPS connections
- Handles mouse command messages
- Emits connection/disconnection events

**D. Mouse Controllers (Platform-Specific)**

**Windows (`WindowsMouseController`):**
- Uses PowerShell with P/Invoke to call `user32.dll`
- Writes temp `.ps1` script to `%TEMP%`
- Spawns `powershell.exe -File script.ps1`
- Waits for "READY" signal before sending commands
- Command protocol:
  ```
  MOVE dx dy
  LEFT_DOWN
  LEFT_UP
  CLICK_RIGHT
  SCROLL delta
  exit
  ```
- Queues commands until PowerShell is ready (max 256)

**Linux (`LinuxMouseController`):**
- Auto-detects session type (`XDG_SESSION_TYPE`)
- X11 → uses `xdotool`
- Wayland → uses `ydotool`
- Executes shell commands per mouse action:
  ```bash
  # X11 examples
  xdotool mousemove_relative --sync dx dy
  xdotool mousedown 1
  xdotool click 3
  # Wayland examples
  ydotool mousemove -r -- dx dy
  ydotool click 0x40
  ```

**E. JSON stdout Protocol**
Server emits structured JSON lines for parent process integration:
```javascript
{ "event": "started", "ip": "192.168.1.100", "port": 8443, "qr": "data:image/png;base64,..." }
{ "event": "connection", "count": 1 }
{ "event": "disconnection", "count": 0 }
{ "event": "stopped" }
{ "event": "error", "code": "EADDRINUSE", "message": "..." }
```

**F. Windows Console Launcher**
When run directly on Windows (not as child process):
- Writes temp `.bat` file with `chcp 65001` (UTF-8)
- Spawns visible console via `cmd /c start "" batPath`
- Self-deletes bat file after execution

**G. Message Validation**
```javascript
function isFiniteNumber(v) {
  return typeof v === 'number' && Number.isFinite(v);
}
```
Rejects NaN/Infinity from reaching mouse controllers.

---

### 5. Mobile Client (`client.html`)

**Single-file progressive web app** - 372 lines

#### UI Components:
- **Status header** - connected/disconnected with glowing dot
- **Sensitivity slider** - 1-25 (default 10)
- **Track pad** - main touch area for motion control
- **Button grid:**
  - LEFT (hold for mouse down/up)
  - RIGHT (tap for right-click)
  - SCROLL (vertical swipe for scroll wheel)

#### Permissions Flow:
1. **Modal overlay** - "Permissions Required"
2. **ALLOW & CONNECT** button
3. Calls `DeviceMotionEvent.requestPermission()` (iOS 13+)
4. On grant → adds `devicemotion` listener
5. Connects to WebSocket server
6. Shows "Ready to Calibrate" prompt
7. **CALIBRATE** button → `state.calibrated = true`, hides modal

#### Motion Handling:
```javascript
function handleMotion(e) {
  const rr = e.rotationRate;  // {alpha, beta, gamma}
  // alpha = pitch (tilt up/down) → vertical movement
  // gamma = yaw (rotate left/right) → horizontal movement
  const dx = Math.round(-gamma * sensitivity * 0.05);
  const dy = Math.round(-alpha * sensitivity * 0.05);
  send({ type: 'move', dx, dy });
}
```

#### WebSocket Protocol:
```javascript
// Client → Server
{ type: 'move', dx: 10, dy: -20 }
{ type: 'down' }           // left mouse down
{ type: 'up' }             // left mouse up
{ type: 'right' }          // right click
{ type: 'scroll', delta: 120 }  // scroll up

// Reconnection
- Auto-reconnects every 2 seconds on disconnect
```

#### Touch Controls:
- **Track pad:** tap to toggle motion on/off
- **LEFT button:** touchstart → down, touchend → up
- **RIGHT button:** touchstart → right click (instant)
- **SCROLL pad:** touchmove → calculate delta → send scroll

---

## 🔐 Security Model

### Current State:
- ✅ Self-signed SSL (required for DeviceMotion API)
- ✅ LAN-only by design (no internet exposure)
- ✅ No authentication (trusted local network assumption)
- ✅ No origin checking on WebSocket connections
- ✅ Secret redaction enabled by default (in logging)

### Warnings:
- ⚠️ **No TLS pinning** - users must accept certificate warning
- ⚠️ **No authentication** - anyone on LAN can connect
- ⚠️ **No rate limiting** - WebSocket accepts unlimited commands
- ⚠️ **0.0.0.0 binding** - listens on all interfaces

---

## 🧪 Testing Strategy

### Test Files:

**`gyroclopter.test.js`** (668 lines)
- ✅ Utility functions (IP detection)
- ✅ Directory management (`ensureAppDir`, `CERT_DIR`)
- ✅ Certificate lifecycle (generate, reuse, regenerate)
- ✅ HTTPS server (status codes, content-type, caching)
- ✅ WebSocket server (connection, message handling)
- ✅ Mouse command validation (move, click, scroll)
- ✅ Error handling (malformed JSON, invalid numbers)

**`server-path.test.js`**
- Validates server.js path resolution in packaged vs development modes

**`start-server-integration.test.js`**
- End-to-end server startup
- IPC communication
- Lifecycle management

### Test Commands:
```bash
npm test              # Run Jest suite
npm run build         # Build installers (run tests first!)
```

---

## 🛠️ Build System

### electron-builder Configuration (`package.json`)

```json
{
  "appId": "com.raposo.gyroclopter",
  "productName": "Gyroclopter",
  "files": ["app/**/*", "server.js", "client.html"],
  "win": {
    "target": "nsis",
    "icon": "build/icon.ico"
  },
  "nsis": {
    "oneClick": false,        // Allow custom install directory
    "perMachine": true,        // Install for all users
    "allowElevation": true
  },
  "linux": {
    "target": "deb",
    "category": "Utility"
  }
}
```

### Build Outputs:
- **Windows:** `dist/Gyroclopter-0.5.0.exe` (~75 MB, NSIS installer)
- **Linux:** `dist/gyroclopter_0.5.0_amd64.deb` (~71 MB, Debian package)

### Build Scripts:
```bash
npm run build          # Clean + build icons + electron-builder --win --linux
npm run build:win      # Windows only (requires Wine on Linux)
npm run build:linux    # Linux only
npm run build:icons    # Generate icon from hero.png
npm run clean          # Remove dist/ and resources/
```

### Build Process:
1. Clean `dist/` and `resources/`
2. Run `build-icon.js` (generates `.ico` and `.png` from `hero.png`)
3. electron-builder packages:
   - `app/` directory
   - `server.js`
   - `client.html`
4. Creates platform-specific installers in `dist/`

---

## 🔄 Data Flow

### Server Startup Sequence:
```
User launches Electron app
    ↓
app/electron-main.js creates window
    ↓
Window 'ready-to-show' → startServer()
    ↓
Spawn: node server.js (stdio: pipe)
    ↓
server.js main()
    ├─ ensureAppDir()
    ├─ getCertificates() → generate or load PEM
    ├─ new GenericMouseController()
    ├─ create HTTPS server (port 8443)
    ├─ create WebSocket server
    └─ server.listen()
         ↓
    Emit: {"event":"started","ip":"192.168.1.100","port":8443,"qr":"..."}
         ↓
stdout → electron-main.js parses JSON
         ↓
mainWindow.webContents.send('server-event', msg)
         ↓
renderer.js updates UI (QR, status, URL)
```

### Mouse Movement Flow:
```
User tilts phone
    ↓
client.html devicemotion event
    ↓
handleMotion() → calculate dx, dy
    ↓
send({type: 'move', dx, dy})
    ↓
WebSocket message to server
    ↓
ws.on('message') → JSON.parse
    ↓
handleWsMessage(data, mouse)
    ├─ validate: isFiniteNumber(dx), isFiniteNumber(dy)
    ├─ multiply: dx *= 1.2, dy *= 1.2
    └─ mouse.sendCommand(`MOVE ${dx} ${dy}`)
         ↓
Platform-specific controller
    ├─ Windows: PowerShell writes to stdin
    │   → user32.dll::mouse_event(0x0001, dx, dy, 0, 0)
    └─ Linux: exec('xdotool mousemove_relative dx dy')
```

---

## 🌐 Network Protocol

### HTTPS Server
- **Port:** 8443
- **Protocol:** TLS 1.2+ (self-signed)
- **Content:** `client.html` (cached in memory)
- **Binding:** `0.0.0.0` (all interfaces)

### WebSocket Messages

**Client → Server:**
```json
{"type": "move", "dx": 10, "dy": -20}
{"type": "down"}
{"type": "up"}
{"type": "right"}
{"type": "scroll", "delta": 120}
```

**Server → Parent Process (stdout):**
```json
{"event": "started", "ip": "192.168.1.100", "port": 8443, "qr": "data:image/..."}
{"event": "connection", "count": 1}
{"event": "disconnection", "count": 0}
{"event": "error", "code": "EADDRINUSE", "message": "..."}
```

---

## ⚙️ Configuration

### Environment Variables:

| Variable | Purpose | Default |
|----------|---------|---------|
| `CERT_DIR` | Override certificate storage location | OS temp dir |
| `IS_CHILD` | Windows: spawn visible console window | false |
| `XDG_SESSION_TYPE` | Linux: session type detection | auto |
| `DISPLAY` | Linux: fallback to X11 if set | - |

### Code Configuration (`server.js:CONFIG`):
```javascript
{
  PORT: 8443,
  APP_DIR: '/tmp/gyroclopter',  // or CERT_DIR
  MOUSE_SENSITIVITY_MULTIPLIER: 1.2
}
```

---

## 🐛 Known Issues

1. **macOS Support Missing**
   - No mouse injection implementation
   - No electron-builder macOS config
   - Avoid adding macOS mouse controls per AGENTS.md

2. **Linux Wayland Compatibility**
   - Requires `ydotool` (not `xdotool`)
   - Auto-detection via `XDG_SESSION_TYPE`
   - Some Wayland compositors may block ydotool

3. **Certificate Warnings**
   - Mobile browsers require manual acceptance
   - No mechanism to auto-trust self-signed cert
   - Expected behavior (documented in README)

4. **No Authentication**
   - Anyone on LAN can connect and control mouse
   - Security through obscurity (unknown port 8443)
   - Not suitable for public/untrusted networks

---

## 📊 Code Statistics

| File | Lines | Purpose |
|------|-------|---------|
| `server.js` | 530 | Core server logic |
| `client.html` | 372 | Mobile UI |
| `tests/gyroclopter.test.js` | 668 | Test suite |
| `app/electron-main.js` | 218 | Electron main process |
| `app/style.css` | 173 | Desktop UI styling |
| `app/renderer.js` | 87 | Desktop UI controller |
| `app/index.html` | 41 | Desktop UI structure |
| `app/preload.js` | 8 | IPC bridge |

**Total:** ~2,100 lines of source code (excluding tests and dependencies)

---

## 🎯 Key Design Decisions

1. **Separation of Concerns**
   - Electron handles UI + lifecycle only
   - Server runs as separate process (crash isolation)
   - Mobile client is pure web (no app install required)

2. **Platform Abstraction**
   - `GenericMouseController` auto-selects implementation
   - Same WebSocket protocol on all platforms
   - Linux session detection (X11 vs Wayland)

3. **Zero External Dependencies for Mouse Control**
   - Windows: built-in PowerShell + P/Invoke
   - Linux: standard tools (`xdotool`/`ydotool`)
   - No native Node.js addons to compile

4. **JSON stdout Protocol**
   - Enables parent process monitoring
   - Structured logging for UI integration
   - Flush after each line (prevents buffering issues)

5. **HTTPS Required**
   - Not for security, but for DeviceMotion API
   - iOS 13+ requires secure context for sensor access
   - Auto-generates certificates at runtime

---

## 📖 Development Workflows

### Daily Development:
```bash
npm install          # One-time setup
npm start            # Launch Electron app with server
# Edit files, app auto-reloads on restart
npm test             # Verify before commit
```

### Building for Release:
```bash
npm test             # Must pass
npm run build        # Produces .exe and .deb
# Test installers
git tag -a v0.5.0 -m "Release v0.5.0"
git push origin main v0.5.0
```

### Adding Features:
1. Create feature branch
2. Implement + tests
3. `npm test` (must pass)
4. `npm run build` (verify installer)
5. Conventional commit message
6. PR → merge to main → tag → GitHub Actions builds

---

## 🔮 Future Considerations

1. **macOS Support**
   - Implement via AppleScript or CGEvent API
   - Requires entitlements for accessibility

2. **Authentication**
   - PIN code pairing
   - Token-based WebSocket auth

3. **Multi-Device Support**
   - Multiple phones controlling same cursor
   - Device prioritization/locking

4. **Configuration UI**
   - Port selection
   - Sensitivity presets
   - Custom button mappings

5. **Tray Notifications**
   - Connection/disconnection alerts
   - Low battery warnings from phone

---

## 📚 External Dependencies

### Runtime (npm):
- `electron` ^43.0.0 - Desktop app framework
- `ws` ^8.21.0 - WebSocket server
- `qrcode` ^1.5.4 - QR code generation
- `selfsigned` ^5.5.0 - Certificate generation

### Dev (npm):
- `electron-builder` ^24.13.3 - Packager
- `jest` ^29.7.0 - Testing
- `pngjs` ^7.0.0 - Icon generation

### System (Linux):
- `xdotool` (X11) OR `ydotool` (Wayland)

### System (Windows):
- PowerShell 5.1+ (built-in)
- No additional dependencies

---

*End of Architecture Map*