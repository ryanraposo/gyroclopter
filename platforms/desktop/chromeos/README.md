# ChromeOS — experimental semantic adapter (#34)

ChromeOS runs the existing Linux host in Crostini. A Manifest V3 extension
uses the ChromeOS desktop Automation tree. It maintains a virtual coordinate,
focuses accessible targets, selects them, requests context menus and scrolls.
This is not native cursor movement or native drag. Stable ChromeOS may not
grant desktop Automation access to this extension.

## Private test setup

1. Enable the Linux development environment. In a checkout of this branch,
   run npm ci. Use the existing Linux runtime; the packaged .deb and native
   hardware acceptance are separate from the development test.
2. In ChromeOS Settings → Developers → Linux development environment → Port
   forwarding, forward TCP 8443 only. Never forward 8444.
3. Load this directory's extension/ unpacked from chrome://extensions. Enable
   Developer mode only for this experiment.
4. Generate a local token in Crostini and start the host:

   ```bash
   TOKEN="$(openssl rand -hex 24)"
   printf '%s\n' "$TOKEN"
   GYROCLOPTER_CHROMEOS_TOKEN="$TOKEN" npm run start:chromeos
   ```

5. Enter the same token and the Chromebook Wi-Fi IPv4 address in the extension
   setup page. The extension stores them locally, authenticates to loopback
   port 8444 and updates the QR address only after authentication.
6. Pair the phone on the same trusted Wi-Fi. Do not expose the phone server
   publicly; the shared Store session-pairing changes (#40) must be integrated
   before broader distribution.

This adapter is explicit opt-in, not automatic Crostini detection. A socket
connection alone does not mean Automation is ready. No input is sent until a
single authenticated extension reports readiness. Replace the token and stop
the host to revoke bridge access. Existing Linux defaults are unchanged.

## Acceptance

Record physical Chromebook model, ChromeOS version and extension policy.
Test Automation access, launcher/shelf, Chrome, Settings, Android and Linux
apps if available; note unsupported surfaces. Test authorization failure,
reconnect, address change, focus/select/context/scroll and release on
disconnect. Do not claim a real system pointer or Chrome Web Store
distribution before verified evidence. See #34 and #41.
