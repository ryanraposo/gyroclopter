# Gyroclopter on the Microsoft Store

The Store build is an x64 desktop AppX for running Gyroclopter on a Windows PC. It opens in the illustrated window. Select **Start Server** to make the pairing QR code available. Scan it from a phone on the same private Wi-Fi, accept the local HTTPS certificate and tap **Allow & Connect**. Select **Stop Server** or **Quit** from the tray to end the session and invalidate the link.

## Build for review and submission

1. Reserve **Gyroclopter** in Partner Center. Under **Product management → Product identity**, record the package identity name, publisher and publisher display name. Confirm that the reserved name matches the manifest display name.
2. Set `WINDOWS_STORE_IDENTITY_NAME`, `WINDOWS_STORE_PUBLISHER` and `WINDOWS_STORE_PUBLISHER_DISPLAY_NAME` as repository variables. From the default branch, run **Windows Store package** with **Build with the configured Partner Center identity** selected. Download the `gyroclopter-partner-center-x64` artifact from the successful run. Pull requests use a dedicated CI identity.
3. For a local build, put the same three keys in a gitignored `store-config.local.json` object or set all three environment variables. In the x64 Native Tools Command Prompt for Visual Studio with Node.js 24, run `npm ci`, `npm test` and `npm run build:win:store`. The package is written to `dist/store/`. Verify it with `pwsh -File scripts/verify-windows-store.ps1`.
4. Use a three-part app version higher than the previous submission. The AppX manifest adds Microsoft Store’s reserved fourth segment `.0`. Keep the package name, publisher and application ID stable for updates. Partner Center signs the distributed package. The CI identity package is for verification and cannot update the Store build.

## Listing draft

### Display name

Gyroclopter

### Short description

Turn your phone into a motion-controlled mouse for your Windows PC.

### Description

Point and tilt your phone to move the pointer on your Windows PC. Scan the pairing QR code on your PC, then use the phone to left-click, right-click, drag and scroll. Adjust pointer and scroll sensitivity from your phone. Gyroclopter works over your private Wi-Fi without an account or a separate phone app.

### Requirements

An x64 Windows PC, a phone with a motion sensor and a browser that supports DeviceMotion, and a shared private Wi-Fi network. Windows may ask you to allow the desktop app through the firewall on private networks. Input is delivered to the standard desktop and is subject to Windows permissions for elevated windows and secure prompts.

### Assets and support

Capture the installed Store build with the illustrated window visible and with the paired phone controls visible. Use staged screenshots with sample pairing info. Upload the Privacy Policy URL and include the project issue tracker as the support URL.

- https://github.com/ryanraposo/gyroclopter/blob/main/PRIVACY.md
- https://github.com/ryanraposo/gyroclopter/issues

## Certification notes draft

Gyroclopter is a desktop utility that receives motion and mouse commands from the user's paired phone over a local HTTPS and WebSocket session. It starts the listener only after the user chooses **Start Server**. The restricted `runFullTrust` capability allows the packaged desktop process and its bundled input helper to run and the helper to call Windows `SendInput`. App operation requires neither an account nor administrator rights. To exercise the feature, start the server, scan the displayed QR code using a phone on the same private network, proceed past the local self-signed certificate warning, grant motion access and tap **Allow & Connect**. Check move, left-click, right-click, drag, and scroll. Choose **Stop Server** to disable the listener and expire the link.

## Installed build acceptance

- In a clean standard-user Windows session, install and launch through a Partner Center test distribution or a separately signed sideload. Check Start menu name and icons, illustrated window, tray, and that the listener is idle before **Start Server**.
- Verify private-network pairing on iOS Safari and Android Chrome. Use the QR code and copy-link flow. Check that a visit to the bare address cannot connect, and that links copied before **Stop Server** are rejected after restart.
- Verify movement, slow and fast diagonal sweeps, both clicks, drag, wheel direction and sensitivity in standard desktop apps. Drop Wi-Fi while holding L, reconnect, then check for a held button. Verify Stop and Quit free the port.
- Run the Windows App Certification Kit on a signed install. Confirm install, upgrade and uninstall in a clean Windows environment, and confirm the ordinary GitHub installer uses its standard window by building it separately.
- Submit the validated Partner Center-identity package, Listing, Privacy Policy, screenshots, age-rating questionnaire and certification notes. After approval, install from the Store and repeat pairing before promoting the listing.

References
- https://learn.microsoft.com/en-us/windows/apps/publish/publish-your-app/app-package-requirements
- https://learn.microsoft.com/en-us/windows/uwp/packaging/app-package-requirements
- https://learn.microsoft.com/en-us/windows/uwp/packaging/app-capability-declarations
