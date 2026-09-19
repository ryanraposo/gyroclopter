# ChromeOS hardware test

ChromeOS support currently uses the normal Gyroclopter Linux host inside
ChromeOS Linux (Crostini) plus a small Manifest V3 bridge extension.

## Fast setup — no terminal

1. **Enable Linux**  
   ChromeOS Settings → Developers → Linux development environment → Set up.

2. **Download the ChromeOS Test Kit** from PR #35's **Build Artifacts Ready**
   card and extract `gyroclopter-chromeos-test-kit.zip`.

3. **Install Gyroclopter** by double-clicking `gyroclopter.deb` and choosing
   **Install with Linux**. Gyroclopter detects Crostini automatically.

4. **Forward port 8443** at ChromeOS Settings → Developers → Linux development
   environment → Port forwarding. Add TCP 8443, label it Gyroclopter, and turn
   it on. Port 8444 stays loopback-only.

5. **Load the extension** at `chrome://extensions`: enable Developer mode,
   choose **Load unpacked**, and select the extracted `extension` folder.

6. **Enter the Chromebook Wi-Fi IP once** in the setup page that opens. Find it
   at ChromeOS Settings → Network → Wi-Fi → your connected network. The
   extension stores it locally and sends it to Gyroclopter over the loopback
   bridge, so the pairing QR refreshes without a restart.

7. **Launch Gyroclopter** from the ChromeOS launcher. The extension badge should
   become **ON**. The setup page should show **Bridge connected** and
   **ChromeOS Automation ready**.

8. **Pair the phone** on the same Wi-Fi: scan the QR, accept the local
   certificate, allow motion access, and calibrate.

The Wi-Fi IP remains a one-time manual field because ChromeOS restricts network
interface discovery for ordinary stable extensions.

## Prototype behavior

This is semantic ChromeOS control rather than native pointer injection. It
maintains a virtual screen coordinate, hit-tests the desktop Automation tree,
focuses accessible targets, invokes default actions for clicks, requests context
menus for right-click, and scrolls scrollable nodes.

Test a Chrome tab, ChromeOS Settings, shelf/launcher, a Linux app, and an Android
app if available. Try motion, left/right click, scroll, Click Stability, window
switching, extension reconnect, and Gyroclopter restart.

If **ChromeOS Automation unavailable** appears, capture the setup page and the
ChromeOS version. If Automation is ready but a surface does not respond, record
which surface failed.
