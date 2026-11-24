# Platform integrations

The runtime registry is composed in `platforms/index.js`. An installed adapter
is a descriptor plus an implementation colocated under its family and target.
No empty adapter files for roadmap entries. Keep issues in the README roadmap.

## Integration checklist

- Desktop adapter: native auto-match only when appropriate; variants selected
  inside the OS adapter. Windows Store is an edition, not a new OS. macOS
  (#39) and Store (#40) must rebase onto dev and register their native work
  under `desktop/macos/` and `desktop/windows/` respectively. Preserve
  helper executable paths and package identities, tests and CI workflows.
- ChromeOS (#34): explicit experimental opt-in, Crostini/host separation,
  semantic scope; authenticate the local extension bridge before exposing
  input, validate readiness and address updates. Browser-only fallback is
  Web Pilot, not equivalent to system input.
- TVs (#26–33, #42–46, #49): organize by OS/protocol, not manufacturer.
  LG SSAP, Android Remote v2, Fire OS and Vega, Tizen, Roku, tvOS, VIDAA,
  Vizio, Titan, TiVo, RDK/Firebolt, HarmonyOS and Whale OS each own their
  adapter and pairing implementation. Use explicit selection, discovery,
  authorization, runtime capability negotiation and clean teardown.
- Browser: one Web Pilot runtime with Standard, Full and Skunk manifests.
  Standard is permission-minimal; privileged editions remain experimental.
  Build/publish separately from Electron; do not inherit desktop privileges.
- External bridge (#47): HID and CEC are distinct capability surfaces; CEC
  does not carry arbitrary pointer movement. Native phone (#48) owns sensor
  capture and direct transports, not desktop input injection.

An adapter may expose system pointer, system semantic/focus, browser-local,
app-local or no control; distinguish these scopes. Document declared vs
observed capabilities, setup, authorization, failure/reconnect and per-device
hardware verification. Use the stable commands contract until a new semantic
operation has both a producer and a consumer. Do not multiply transport or UI
implementations just to add targets.
