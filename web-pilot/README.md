# Gyroclopter Web Pilot — 0.6 Skunk Works

This edition answers a deliberately unreasonable question:

**What if Gyroclopter were just there whenever you visited a webpage?**

The phone remains the motion controller. An unpacked Manifest V3 extension makes ordinary HTTP(S) pages Web-Pilot-aware automatically, and the phone surface lives at:

`https://ryanraposo.github.io/gyroclopter/`

The Page is public but inert. A live pairing capability arrives only in its URL fragment.

## What is different about Skunk Works?

The eventual public edition should be conservative about permissions and explicit about activation.

Skunk Works optimizes for learning what the product *could* feel like:

- broad HTTP(S) host access is granted once when the unpacked extension is installed;
- the content layer is already present when a normal page loads;
- pairing is sticky for the lifetime of the expiring relay session;
- when the phone connects, the current tab wakes automatically;
- switching tabs transfers the cockpit;
- navigation rearms after the new document loads;
- the interaction field learns locally per origin by default;
- Full Control/CDP is available as an experimental fallback;
- **Pause everywhere**, `Esc`, and **Forget phone** remain immediate exits.

The goal is one setup moment followed by essentially no ceremony.

## Architecture

```text
GitHub Pages on phone
  DeviceMotion + buttons
        │
        │ room/key + relay only in #fragment
        ▼
private WSS relay
  ephemeral capability
  normalized pointer protocol only
        │
        ▼
Skunk Works extension
  ambient on HTTP(S)
  active-tab handoff
        │
        ├─ standard DOM/pointer path
        └─ optional CDP Input path
                 │
                 ▼
          interaction field
          local per-origin learning
```

## Private test

### 1. Build

```bash
git checkout 0.6-skunk
npm ci
npm run web:build
npm run web:verify
npm test
```

Build outputs:

- `dist/web-pilot` — conservative standard build.
- `dist/web-pilot-full` — explicit Full Control build.
- `dist/web-pilot-skunk` — ambient Skunk Works build.

### 2. Publish the phone shell once

In GitHub: **Settings → Pages → Deploy from a branch → `0.6-skunk` → `/docs`**.

That exposes the inert controller at `https://ryanraposo.github.io/gyroclopter/`.

### 3. Start the private relay

```bash
npm run web:dev
```

The relay uses local HTTPS/WSS and generates a self-signed certificate for private testing. Accept/trust it on the desktop and phone once. The QR produced by the extension points at the GitHub Page and carries the relay/room/key only after `#`.

### 4. Load Skunk Works

Open `chrome://extensions`, enable **Developer mode**, choose **Load unpacked**, and select:

```text
dist/web-pilot-skunk
```

This build intentionally asks for broad website access and Chrome debugger access. It is not the permission posture intended for an unquestioned public store release.

### 5. Pair once

Open the extension popup, trust the local relay, click **Pair phone**, scan the QR, and tap **Enable Motion** on the phone.

With **Ambient Pilot** enabled, that is the last ordinary activation step.

Visit a normal site. Gyroclopter wakes there. Switch tabs. It follows. Navigate. It returns when the page finishes loading.

## Interaction-field learning

Each origin gets a tiny local profile containing bounded gain, attraction radius/strength, coarse target-category weights, and accepted/rejected attraction counts.

The field never reads element text. It uses geometry and coarse interactive roles. If attraction helps and you click through it, that category gains a little weight. If your next motion sharply corrects against the attraction, that category loses weight. Everything is bounded and resettable.

## Browser boundary

Normal content-script events are synthetic; some custom apps reject them. Full Control uses Chrome's privileged debugger/CDP Input path for those cases. Chrome internal pages and extension-restricted surfaces are not controllable.

## Publication boundary

The Skunk Works Page is meant to be exciting and public. The relay and unpacked extension remain private test infrastructure until a production domain, real TLS, final extension ID, privacy/store answers, and public permission posture are deliberately chosen.

See `SECURITY.md`, `PRIVACY.md`, and `PUBLISHING.md`.
