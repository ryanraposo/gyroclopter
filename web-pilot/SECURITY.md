# Web Pilot security model

Web Pilot treats remote pointer control as a capability that must remain visible, narrow, and easy to kill.

## Editions

The normal Web Pilot build is permission-efficient: site access is optional and a tab is armed explicitly.

**Skunk Works is intentionally different.** It is an unpacked/private experiment that asks for broad HTTP(S) host access up front so its content script is already present when a page is visited. When Ambient Pilot is enabled and the paired phone is connected, control follows the active ordinary web tab automatically.

That convenience does not remove the kill paths:

- `Esc` disarms immediately.
- **Pause everywhere** disables Ambient Pilot and disarms.
- Closing the controlled tab disarms.
- Forgetting the phone disarms and deletes the stored capability.
- Changing Full Control mode detaches and rearms cleanly.
- Password fields are excluded from the interaction field.
- Chrome internal pages, the Web Store, and other extension-restricted surfaces are outside the supported control boundary.

## Full Control

The Skunk Works build declares Chrome's `debugger` permission so CDP Input is available for stubborn canvas/custom-control sites. It is **not** the first input path: the virtual cursor and interaction field still run first, and Full Control is a user-visible toggle.

Chrome visibly represents debugger attachment. That is expected and desirable in this experiment.

## Pairing

A relay session uses a random room identifier plus a random 192-bit secret. Both the phone and extension must present both values before the relay associates them.

The reference relay:

- keeps sessions in memory only;
- expires sessions automatically (12 hours by default in Skunk Works, configurable);
- limits WebSocket payloads to 4 KiB;
- validates an explicit pointer-event allowlist;
- range-checks numeric movement;
- rate-limits controller input and pairing creation;
- caps the number of live sessions;
- times out unauthenticated sockets;
- allows one pilot and one controller per room.

No arbitrary JavaScript, keyboard text, DOM selector, page URL, screenshot, shell command, or form value can cross the relay protocol.

The normal edition keeps pairing in `chrome.storage.session`. Skunk Works additionally remembers the same expiring capability in `chrome.storage.local` so Chrome can restart without forcing another QR scan during that live relay session. **Forget phone** deletes it.

## GitHub Pages controller

The public controller page contains no standing credential. A pairing URL has the form:

`https://ryanraposo.github.io/gyroclopter/#relay=...&room=...&key=...`

Everything after `#` is handled by the browser and is not part of the HTTP request sent to GitHub. The Page is inert without that fragment.

The controller WebSocket origin must match the configured controller origin. Pilot sockets must come from a Chrome extension origin. For a public relay, set `WEB_PILOT_EXTENSION_IDS` to the final extension ID.

## Local test TLS

Private testing generates a self-signed certificate under `~/.gyroclopter/web-pilot` with user-only key permissions. Self-signed TLS is development plumbing only.

A real hosted relay must use a real HTTPS/WSS certificate and an explicit `PUBLIC_BASE_URL`. Production mode refuses to start without an HTTPS public base URL.

## Data minimization

Interaction-field learning stays inside `chrome.storage.local`. The relay has no database and does not need to know what page is being controlled.
