# Skunk Works publishing boundary

The 0.6 experiment intentionally stops short of a production domain or store release.

## GitHub Pages

Publish the phone controller from this branch:

1. Repository **Settings → Pages**.
2. Source: **Deploy from a branch**.
3. Branch: **0.6-skunk**.
4. Folder: **/docs**.
5. Save.

The resulting controller is expected at:

`https://ryanraposo.github.io/gyroclopter/`

The Page contains no standing credentials. Pairing arrives after `#` in the URL, so GitHub does not receive the room/key in the HTTP request.

## Before a real launch

A production release still needs a stable HTTPS/WSS relay origin, the final extension ID allowlisted by the relay, store/privacy questionnaire answers, and a deliberate choice about whether broad Skunk Works permissions remain in the public edition.

Do not point the 0.6 relay at a production domain until those decisions are made.
