CHANGELOG

v0.3.1 — Latest Release

Released: Jun 27, 2026
Published via GitHub Actions

Changes

* Replaced Electron / SEA / postject build pipeline with @yao-pkg/pkg single-file binary
* Windows deliverable: NSIS installer (MUI_ICON), no icon embedded in bare .exe
* Linux deliverable: plain dpkg-deb .deb package
* QR code fix on Windows: cmd console set to UTF-8 codepage via chcp 65001
* CI: smoke-test each artifact on the runner (boot binary, verify port 8443, kill)
* CI: pushes to main update a single draft release tagged "latest" for manual verification
* CI: tags (v*) publish a real release
* Removed dev deps: electron, electron-builder, postject, pe-library, rcedit

⸻

v0.3.0

Released: Jun 27, 2026
Published via GitHub Actions

Improvements

* Refined Linux packaging metadata: explicit `desktopName`, `linux.category`, `linux.syncDesktopName`, and a custom application icon set
* Added Windows NSIS installer to the release pipeline (`build-exe` job) so `.exe` artifacts ship alongside `.deb`
* Added `npm run icons:generate` script and committed icon assets under `build/icons/` and `build/icon.ico`

⸻

v0.2.0

Released: Jun 27, 2026
Published via GitHub Actions

Major Features

* Confirmed native Linux support (X11 + Wayland)
* Added automatic X11 ↔ Wayland detection and switching
* Introduced full gyro calibration system with improved stability
* Packaged application as distributable .deb
* Streamlined build + release pipeline via GitHub Actions

⸻

v0.1.0

Released: Jun 23, 2026
Published via GitHub Actions

Features

* Initial Linux support baseline
* Early gyro calibration implementation
* Basic console enforcement layer
* Initial automated release workflow setup
