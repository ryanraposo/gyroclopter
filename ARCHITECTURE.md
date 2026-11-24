# Gyroclopter architecture

Gyroclopter is one motion controller and a family of target integrations. The
host running the server, the surface being controlled, the mechanism used to
control it, and the distribution edition are separate decisions.

```
Phone (web today; native mobile in #48)
      │ validated motion and button events
      ▼
Transport and session (server.js / Web Pilot relay)
      │ stable input commands
      ▼
Input contract + adapter selection (input/)
      │
      ├── Desktop: Windows, Linux, macOS, ChromeOS
      ├── TV: OS-specific paired LAN, focus or pointer
      ├── Browser: Web Pilot, with explicit per-tab authority
      └── Bridge: HID and CEC
```

## Repository boundary

| Location | Responsibility |
| --- | --- |
| `client.html`, `app/`, `server.js` | Existing mobile web controller, Electron host and HTTPS/WSS transport/session. |
| `input/commands.js` | Wire validation and stable command vocabulary. |
| `input/registry.js`, `input/index.js` | Registry, selection, contract and compatibility facade. |
| `platforms/index.js` | Composition root: explicitly registers real Node adapters. |
| `platforms/desktop/<os>/` | Native desktop adapters, helpers and OS-specific integration. Windows and Linux live here now. |
| `platforms/tv/<os>/` | Future paired network receiver/remote adapters, discovery and device-specific capabilities. |
| `platforms/browser/web-pilot/` | Browser runtime, extension adapters, relay and edition manifests; not a native desktop backend. |
| `platforms/bridge/<mechanism>/` | Future hardware/HID/CEC adapters. |
| `platforms/mobile/<os>/` | Future native phone controller sources; input source, not target adapter. |
| `docs/` | Published static Web Pilot phone shell when browser work lands. |
| `native/`, `scripts/`, `tests/` | Existing build/test entry points. OS-specific native source may migrate next to its adapter; packaged helpers remain outside asar. |

Future directories are conventions, not claims of implementation. See [platform
integration rules](platforms/README.md) and [#41](https://github.com/ryanraposo/gyroclopter/issues/41).

## Runtime contract

The existing API stays compatible: `createInputController(options)` and
`resolveInputBackend(options)`. An adapter descriptor has a unique id, family,
scope, declared capability ceiling, explicit factory and optional aliases.
Only local desktop descriptors may auto-match the host. Higher match priority
wins; an ambiguous match fails. An explicit `adapterId` or
`GYROCLOPTER_INPUT_BACKEND` selects a registered adapter, never an arbitrary
module path. Unknown ids fail immediately. Remote targets always require
explicit selection and pairing; unsupported hosts remain unavailable.

The factory returns `name`, boolean `available`, `sendCommand(command)`,
and `dispose()`. Existing callbacks `onError` and `onAvailability` remain.
The stable input vocabulary is `MOVE dx dy`, `LEFT_DOWN`, `LEFT_UP`,
`CLICK_RIGHT`, `SCROLL delta`. Session ownership and release belong to the
transport/session layer; the adapter owns actual input delivery and cleanup.

`describeInputBackend(options)` and `listInputBackends()` expose declared
metadata, **not hardware verification or negotiated capability**. A capability
ceiling is not a promise: later network adapters must report runtime readiness
and device-specific supported actions separately. No fake system-wide pointer
for focus-only or app-local platforms. Add versioned typed focus/home/back/media
operations only when implemented, preserving existing browser messages.

Browser extensions run in their own runtime and cannot import the Node
registry. They implement the same semantic input/session boundary using their
own browser-specific code. Do not route all browser activity through Electron.

## Distribution and editions

A Windows Store build and standalone Windows build target the same OS; select a
native backend variant inside the Windows factory using explicit edition config.
macOS packages use the same core and their native helper. Linux selects X11
or Wayland within its adapter. ChromeOS has a distinct semantic adapter despite
Crostini reporting Linux. Web Pilot Standard/Full/Skunk are editions of the
browser platform, with different permissions, not different OS adapters.

Only registered and tested integrations are active. Keep the shared server,
mobile wire format, installer identities, native build and CI behavior intact
when adding a platform. Test adapters with fixtures and validate actual
permissions, lifecycle and input on physical hardware before claiming support.
