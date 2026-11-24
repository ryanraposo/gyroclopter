# Shared TV runtime (#41)

- discovery.js validates manual private IPv4 targets and deduplicates candidate records; protocol-specific discovery providers remain adapter work.
- contract.js validates typed actions and intersects declared and observed capabilities.
- focus.js converts fresh motion into bounded, rate-limited directional steps without timer-driven replay.
- session.js requires an authorized transport reporting ready/unavailable/error, gates actions, resets input on disconnect and provides a versioned capability snapshot.

A real adapter owns TV pairing, credential storage, certificate trust, discovery and transport. Before enabling a TV adapter in the shared server, require a fresh authenticated phone session, cancel input on disconnect, and publish the negotiated capability snapshot. The Android integration will wire these boundaries; no TV platform is marked supported by the fixture tests. Pointer, drag, focus, media and hardware verification remain distinct. No stale commands are queued. Full discovery and physical validation are per-adapter follow-ups.
