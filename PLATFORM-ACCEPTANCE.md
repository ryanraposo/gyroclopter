# Platform integration and release acceptance

- main is the stable release line; dev is the integration line. Keep one active feature PR into dev, except temporary consolidation or release work.
- Native builds are verified using the platform workflows currently present. macOS distribution uses one universal PKG; the review workflow expands its payload and checks the bundled binaries. Public release requires Developer ID Application and Installer signatures, notarization and stapling. A portable or packaged smoke test is not physical input acceptance.
- Before a dev-to-main release PR, update version and changelog; verify installed Windows/Linux/macOS, explicitly document experimental ChromeOS and Web Pilot scope, and check Store signing/Partner Center requirements.
- GitHub Pages: verify the actual deployment source in Settings → Pages before retiring 0.6-skunk or other historical refs. The Web Pilot shell now resides in dev/docs; migrate only after deciding the intended permanent deployment source. Do not deploy a release branch just to publish an experiment.
- Historical #36 is superseded by #38, #39 and #50, with #40 providing Store integration. Its original head is 49ea85a4765092f2566376242eab386bb6b9b255. Keep the historical refs until Pages and remaining release artifacts are audited; closing a PR does not delete its source.
- The historical click-stability experiment is preserved as input/click-stability.js with its tests. It is not wired into the existing phone UI or enabled by default; evaluate separately before changing pointer/drag behavior.
- Reconcile release documentation and automation before promoting dev to main. No physical hardware or Store certification is implied by this consolidation.
