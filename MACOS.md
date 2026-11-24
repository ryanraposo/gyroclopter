# Gyroclopter for macOS

The universal macOS package contains the Electron app and a CoreGraphics input helper for Apple silicon and Intel. Build the DMG and ZIP on macOS with Xcode command-line tools and Node.js 24.

```sh
npm ci
npm run build:mac -- --publish=never
```

The macOS package workflow builds review artifacts without Developer ID credentials. Public distribution requires a Developer ID signature and notarization. Use the normal electron-builder signing and Apple notarization credentials for that build.

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
