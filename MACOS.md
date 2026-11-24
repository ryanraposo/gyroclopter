# Gyroclopter for macOS

The universal macOS package contains the Electron app and a CoreGraphics input helper for Apple silicon and Intel. Build the single universal PKG installer on macOS with Xcode command-line tools and Node.js 24.

```sh
npm ci
npm run build:mac -- --publish=never
```

The output is `dist/Gyroclopter-<version>.pkg`. Open the package, follow the native Installer prompts, then launch Gyroclopter from Applications. No separate Intel or Apple silicon download is required.

The [macOS package workflow](.github/workflows/macos-package.yml) creates an unsigned review installer. `bash scripts/verify-macos-pkg.sh` expands the actual PKG and checks the install location, both executable architectures, the bundled application archive and helper self-test. It does not establish physical input or Gatekeeper acceptance.

For public distribution, sign the app with Developer ID Application and the installer with Developer ID Installer (`CSC_LINK` / `CSC_KEY_PASSWORD` and `CSC_INSTALLER_LINK` / `CSC_INSTALLER_KEY_PASSWORD`), notarize the final PKG and staple its ticket. Verify with `pkgutil --check-signature`, `xcrun stapler validate` and `spctl -a -vv -t install` before publishing. Do not publish unsigned CI review installers as production releases.

## Pairing and Accessibility

1. Install and launch Gyroclopter from Applications. Scan the QR code from a phone on the same private Wi-Fi and tap **Allow & Connect** in the phone browser.
2. If the desktop says **Allow Accessibility**, open **How to fly?** and select **System Settings**. In Privacy & Security → Accessibility, enable Gyroclopter.
3. Fully quit and reopen the app. If permission is still denied, also add `Gyroclopter.app/Contents/Resources/native/gyroclopter-mouse` from the installed bundle to the same Accessibility list. The desktop status tooltip shows the helper path used for that run. After replacing a review build, macOS may require removing and adding the entry again.

If macOS requests Local Network access, allow Gyroclopter to accept the phone connection.

## Physical input acceptance

- Start with Accessibility denied and verify that **Allow Accessibility** appears. Grant access, reopen the app, and verify that the pointer responds.
- With the phone upright, tilt slowly along each axis, then make a fast diagonal sweep. Check for hesitation, jumps, and reversed axes. Repeat near screen edges and across two displays of different scales.
- Hold L while tilting to drag a Finder item, then release. Repeat and drop Wi-Fi while holding L. Reconnect and verify the pointer moves normally. Check that R opens the context menu.
- Swipe in both directions to scroll. Individual steps should advance by desktop scroll lines.
- Stop and restart the server with a phone connected. Repeat pairing after an app restart and run the same checks on Apple silicon and Intel where available.

The native helper's `--self-test` checks event type, coordinates and relative deltas without posting events. Hardware testing verifies that macOS actually grants permission and delivers those events to the desktop.
