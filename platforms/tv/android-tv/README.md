# Android / Google TV Remote v2 prototype (#27)

This source-checkout integration provides directional focus, Select, Back,
Home and media keys through the Android TV Remote service (6467 pairing,
6466 control). No ADB, root, receiver app or system pointer claim. Android
TV Remote v2 is an independently implemented protocol; hardware and
distribution/terms review are still required.

1. Install Python 3.11+ and make a private virtual environment. Run
   `python -m pip install -r platforms/tv/android-tv/requirements.txt`.
2. In that environment run
   `python platforms/tv/android-tv/bridge.py pair --host 192.168.1.50 --state /absolute/private/device-directory`.
   Enter the code displayed on the TV. The PIN-verified device certificate
   is saved as a trust anchor; later sessions require TLS verification and
   the exact certificate. Do not log the PIN or share the private key.
3. From the repository, run npm ci. Set GYROCLOPTER_INPUT_BACKEND=android-tv,
   GYROCLOPTER_ANDROIDTV_HOST to the same LAN IP,
   GYROCLOPTER_ANDROIDTV_CREDENTIALS to the absolute directory, and
   GYROCLOPTER_ANDROIDTV_PYTHON to the virtual environment Python path.
   Run `node server.js` and open the pairingUrl from its local stdout on
   the phone (keep the link private). The host forces a fresh phone pairing
   key and accepts one controller. Tilt for directional focus; L/OK selects,
   R/BACK returns. Home and Play/Pause appear only when ready.
4. On a real TV test pairing rejection, certificate change, reconnect,
   abandoned press, launcher and two apps, and record model/firmware and
   latency. Verify Windows credential ACLs and installation separately.

Manual IPv4 is implemented; mDNS discovery, device picker, reliable
re-pair UI, native HID, app launch/text and packaging remain follow-ups.
A Python helper is deliberately optional and not part of desktop installers.
PinnedRemote uses private upstream internals for certificate pinning; keep the
dependency fixed and test this against actual hardware before production.
Dependency: https://github.com/tronikos/androidtvremote2 (Apache-2.0).
