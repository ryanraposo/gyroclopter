# ChromeOS hardware test

This branch implements ChromeOS as a **semantic Gyroclopter host**.

The normal Gyroclopter Electron/Node app runs inside ChromeOS Linux (Crostini).
A small unpacked Manifest V3 extension runs on the ChromeOS side and receives
the stable Gyroclopter input commands over a loopback-only WebSocket bridge.

The extension uses ChromeOS desktop Automation hit-testing and actions. This is
deliberately not presented as native cursor injection.

## What should work

- phone pairing over the existing HTTPS/WSS flow
- motion moving a virtual screen coordinate
- hit-testing the ChromeOS desktop at that coordinate
- focus following the current target
- left click on release via the target's default action
- right-click/context menu where the Automation node supports it
- vertical scrolling on scrollable Automation nodes

## Known limitation

This first hardware spike does **not** synthesize the real ChromeOS pointer.
ChromeOS's direct synthetic mouse API is private/allowlisted. Dragging is also
not equivalent to native mouse drag: LEFT_DOWN remembers the target and LEFT_UP
activates the release target.

The point of this branch is to learn how good the public desktop Automation
surface actually feels on real ChromeOS hardware.

## Setup

### 1. Enable Linux

ChromeOS Settings → Developers → Linux development environment → Set up.

### 2. Download the CI artifacts

PR CI publishes everything needed for the Chromebook test:

- `gyroclopter-0.5.0.deb` — the Linux/Crostini host
- `gyroclopter-chromeos-extension.zip` — the ChromeOS bridge extension

Download both from the PR's **Build Artifacts Ready** card.

Unzip the extension into Downloads (or another folder visible to ChromeOS).

Install the host from the Linux Terminal:

```bash
sudo apt install ./gyroclopter-0.5.0.deb
```

If the file is in ChromeOS Downloads rather than the Linux home directory, copy
it into **Linux files** first from the Files app, then run the command above.

### 3. Expose the phone-facing port

ChromeOS Settings → Developers → Linux → Port forwarding.

Add:

- port: `8443`
- protocol: TCP
- label: Gyroclopter

Turn it on.

### 4. Find the Chromebook LAN IP

ChromeOS Settings → Network → your Wi-Fi network.

Use that address below, for example `192.168.1.42`.

### 5. Start Gyroclopter in ChromeOS mode

```bash
GYROCLOPTER_INPUT_BACKEND=chromeos GYROCLOPTER_PUBLIC_HOST=192.168.1.42 gyroclopter
```

The public-host override matters because the Linux container has its own private
address, while the phone connects to the Chromebook's Wi-Fi address through
ChromeOS port forwarding.

### 6. Load the ChromeOS bridge extension

Open `chrome://extensions`.

1. Enable **Developer mode**.
2. Choose **Load unpacked**.
3. Select the unzipped CI artifact folder containing `manifest.json` and `service-worker.js`.

For development only, the same extension source lives at `chromeos/extension` in the repository.

The extension badge should show **ON** once it reaches Gyroclopter at
`ws://localhost:8444`.

ChromeOS automatically tunnels localhost ports into the Linux environment; port
8444 does not need to be exposed to the LAN.

### 7. Pair the phone

Use the normal Gyroclopter QR code.

The phone and Chromebook must be on the same Wi-Fi network. Accept the local
certificate warning and grant motion permission as usual.

## What to test

Try these surfaces separately:

1. a normal Chrome tab
2. ChromeOS Settings
3. shelf / launcher
4. a Linux app
5. an Android app, if available

For each one, test:

- motion / target following
- left click
- right click
- scroll
- switching between windows
- reconnect after reloading the extension
- reconnect after restarting Gyroclopter

## Debugging

Open `chrome://extensions`, find **Gyroclopter ChromeOS Bridge**, and inspect
its service worker.

Useful signals:

- badge `ON`: loopback bridge connected
- badge `OFF`: Gyroclopter bridge is not reachable
- `ChromeOS input bridge listening on ws://127.0.0.1:8444`: Linux side ready
- Automation manifest/API rejection: important hardware/platform result; capture
  the exact ChromeOS version and error

If `automation.desktop` loads but particular surfaces do not hit-test or act,
record which surface failed. That boundary determines whether semantic ChromeOS
control is product-worthy.
