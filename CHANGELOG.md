CHANGELOG

v0.2.0 — Latest Release

Released: Jun 27, 2026
Published via GitHub Actions

Major Features

* Confirmed native Linux support (X11 + Wayland)
* Added automatic X11 ↔ Wayland detection and switching
* Introduced full gyro calibration system with improved stability
* Packaged application as distributable .deb
* Streamlined build + release pipeline via GitHub Actions

Improvements

* Refined Linux packaging metadata: explicit `desktopName`, `linux.category`, `linux.syncDesktopName`, and a custom application icon set
* Added Windows NSIS installer to the release pipeline (`build-exe` job) so `.exe` artifacts ship alongside `.deb`
* Added `npm run icons:generate` script and committed icon assets under `build/icons/` and `build/icon.ico`

⸻

v0.1.0

Released: Jun 23, 2026
Published via GitHub Actions

Features

* Initial Linux support baseline
* Early gyro calibration implementation
* Basic console enforcement layer
* Initial automated release workflow setup
