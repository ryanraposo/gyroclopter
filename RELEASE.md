# Releases

1. Prepare release changes on `dev`, update `package.json` and `CHANGELOG.md`, and run the portable checks in `CONTRIBUTING.md`.
2. Review the `dev` → `main` release PR and validate installers on their target systems.
3. Use the **build-artifacts** manual workflow for deliberate native-package testing. Ordinary PR updates run only the portable Ubuntu CI job.
4. Once the release is accepted, create and push its `v*` tag. The tag workflow tests, builds Windows/Linux/macOS packages, packages the ChromeOS test kit, and creates the GitHub Release.
5. Inspect the release attachments and test the installed products before announcing support. ChromeOS Automation coverage and Web Pilot pairing require physical-device acceptance.

A push to `main` alone does not create a draft or publish a release. The native workflow runs only on an explicit manual dispatch or a `v*` tag. macOS signing/notarization still requires its existing credentials and release setup.
