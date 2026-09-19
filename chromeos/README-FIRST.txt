GYROCLOPTER · CHROMEOS TEST KIT

No terminal is required after ChromeOS Linux is enabled.

1. ENABLE LINUX
   ChromeOS Settings → Developers → Linux development environment → Set up.

2. INSTALL GYROCLOPTER
   Double-click gyroclopter.deb in this folder.
   Choose “Install with Linux” and let ChromeOS finish.

3. FORWARD ONE PORT
   ChromeOS Settings → Developers → Linux development environment → Port forwarding.
   Add port 8443, TCP, label Gyroclopter, and turn it on.

4. LOAD THE CHROMEOS BRIDGE
   Open chrome://extensions
   Turn on Developer mode → Load unpacked → select the extension folder.

5. ENTER THE CHROMEBOOK WI-FI IP ONCE
   The extension setup page opens automatically.
   Find it under ChromeOS Settings → Network → Wi-Fi → connected network.
   Save it.

6. LAUNCH GYROCLOPTER
   Open Gyroclopter from the ChromeOS launcher.
   Crostini is detected automatically. The extension badge should become ON
   and the QR code will update to the saved Chromebook IP.

7. PAIR
   Same Wi-Fi → scan QR → accept local certificate → allow motion → calibrate.

If “ChromeOS Automation unavailable” appears, capture that screen and the
ChromeOS version. That is a platform capability result, not a setup mistake.
