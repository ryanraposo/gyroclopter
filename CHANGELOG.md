# [0.5.0](https://github.com/ryanraposo/gyroclopter/compare/v0.3.1...v0.5.0) (2026-06-30)


### Added

* Electron desktop app with system tray, QR code pairing, and server lifecycle management
* High-quality icons with Lanczos3 resampling and adaptive sharpening (16x16–512x512)
* Favicon support for browser tab icons (desktop app and mobile client)
* GitHub Actions CI/CD pipeline with automated builds and artifact posting
* Direct download links via artifact.ci integration (90-day retention)
* Automated PR comments with build artifact links (keeps latest 3)
* Smart workflow triggers (PRs to main and v* tag pushes)
* Smoke tests for .exe and .deb before posting artifact links
* Platform-specific setup scripts in README.md
* AGENTS.md with consolidated architecture docs and project structure


### Changed

* Migrated to Electron with full desktop app (system tray, auto-start, single-instance lock)
* Server spawning uses ELECTRON_RUN_AS_NODE for asar archive support
* Updated to electron-builder v26 (resolved 5 high-severity tar vulnerabilities)
* IPC architecture with secure context isolation and preload script bridge
* Linux builds include --no-sandbox flag and tailable log files
* Desktop window UI polish (taller window, removed visual gaps, updated screenshots)
* Manual CHANGELOG maintenance (removed conventional-changelog)


### Fixed

* use ICO format for tray icon on Windows ([d0ad652](https://github.com/ryanraposo/gyroclopter/commit/d0ad652b18f71217d2e7e1eea3995daa6e25a224))
* Cross-platform ICO generation using png-to-ico library
* Rapid start/stop toggle prevention with state guards
* Server errors properly emitted and displayed in UI
* Windows build auto-start, window title/icon fixes
* Playwright downgraded for stability


### Removed

* Conventional-changelog automated release notes


### Security

* Upgraded electron-builder from v24 to v26, resolving 5 high-severity tar vulnerabilities
* Sharp library for high-quality image processing


### Testing

* Jest suite with 26 tests covering IPC, server paths, startup logic, UI interactions
* Mock infrastructure for Electron IPC, server spawning, WebSocket handlers
* CI enforcement requiring tests to pass before merge


### Build Artifacts

* Windows: gyroclopter-0.5.0.exe (NSIS installer)
* Linux: gyroclopter_0.5.0_amd64.deb (Debian package)



## [0.3.1](https://github.com/ryanraposo/gyroclopter/compare/v0.3.0...v0.3.1) (2026-06-27)


### Bug Fixes

* make npm start launch server and generate valid self-signed certs ([bb00eed](https://github.com/ryanraposo/gyroclopter/commit/bb00eed24d2578c338968fafdd3a7e191651dcb7))


### Features

* gyro-based air mouse movement on Linux/Wayland ([1c24c3d](https://github.com/ryanraposo/gyroclopter/commit/1c24c3d04e8892ec5a648a6c874b80eaf0812c14))
* improve client controls and sync tests ([bfe8b96](https://github.com/ryanraposo/gyroclopter/commit/bfe8b966ce22653eaec6f37e3418b9e4545452f4))



# [0.1.0](https://github.com/ryanraposo/gyroclopter/compare/d5d20362c821dc30af2e984568ca68fe931035b9...v0.1.0) (2026-06-23)


### Features

* add Linux X11/Wayland auto-switch & improve gyro calibration ([26d34df](https://github.com/ryanraposo/gyroclopter/commit/26d34df4dd5f6499ee02397ea08b1b35d5aae448))
* implement calibration, console enforcement, and updated release workflow ([d5d2036](https://github.com/ryanraposo/gyroclopter/commit/d5d20362c821dc30af2e984568ca68fe931035b9))



