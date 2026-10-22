# Web Pilot privacy notes

Web Pilot is designed so the relay does not need to know what the user is controlling.

## Stored in the browser

Per-origin interaction profiles stay local to the extension. A profile contains only bounded numeric tuning values and coarse target-category weights. It does not store page text, form values, screenshots, element labels, or page contents.

The origin is used as the local profile key so different sites can learn different pointer behavior.

The normal Web Pilot build keeps pairing credentials in `chrome.storage.session`. The private **Skunk Works** build also keeps the same expiring pairing capability in `chrome.storage.local` so the phone can reconnect after Chrome restarts without another QR scan. The capability can be deleted at any time with **Forget phone**, and the relay rejects it after the session expires.

## Sent through the relay

The phone sends only normalized pointer actions:

- relative movement;
- left down/up;
- right click;
- scroll delta.

The extension may send coarse state such as whether control is armed and whether Full Control is active. The relay does not receive the controlled site's URL, DOM, page text, form values, screenshots, or interaction-field target list.

## GitHub Pages

The Skunk Works phone UI is static. Pairing data is carried in the URL fragment after `#`, which browsers do not include in the HTTP request for the Page. GitHub therefore serves the same inert controller shell whether or not a pairing exists.

## Relay retention

The reference relay stores sessions in process memory only. It has no database, analytics SDK, advertising SDK, telemetry endpoint, or browsing log.

Before a public launch, this document should become the basis of the public privacy policy and be reconciled with the Chrome Web Store privacy questionnaire.
