CONTRIBUTING

This project follows a simple, deterministic release flow designed to keep builds reproducible and releases traceable.

⸻

🧭 Branch Structure

* dev → active development
* main → stable releases only

All work flows from dev into main via pull requests.

⸻

🔁 Development Flow

1. Work on dev

All feature work, fixes, and experimentation happens here.

git checkout dev

⸻

2. Before opening a PR

You must prepare a release snapshot:

* Bump version in package.json
* Update CHANGELOG.md

Example:

{
  "version": "0.5.0"
}
## v0.5.0
- Improved gyro stability
- Reduced websocket jitter
- UI polish pass

⸻

3. Open Pull Request

dev → main

PRs should represent a release-ready state, not partial work.

⸻

4. Merge into main

Once merged, the CI pipeline automatically:

* Runs the Jest test suite on every push and PR
* Reads version from package.json
* Builds the Windows NSIS installer (`dist/gyroclopter-setup-<version>.exe`) on Windows runners
* Builds the Linux `.deb` package (`dist/gyroclopter_<version>_amd64.deb`) on Ubuntu runners
* Smoke-tests each artifact on the runner that built it (boots the binary, confirms port 8443 is listening, kills it)
* **On push to `main`**: uploads both artifacts to a single draft release tagged `latest` so you can verify the binaries match what your users will download
* **On push to a `v*` tag**: publishes a real release

The two build jobs are independent and run in parallel after `test` passes.

⸻

⚙️ Release Principle

* main = release trigger
* package.json = source of truth for version
* CHANGELOG.md = human-readable release narrative

No manual tagging is required in this workflow.

⸻

🚀 Golden Rule

If it lands on main, it ships.

⸻

📦 Releasing

Tag a release once the `latest` draft looks good:

```bash
git checkout main
git pull
# Bump version in package.json + add CHANGELOG entry.
git tag v0.4.0
git push origin v0.4.0
```

The push triggers a real release job (not draft). Delete or update the `latest` draft after publishing.

⸻

🛠️ If a binary is bad

The `latest` draft is your safety net. If the smoke test passes but the binary doesn't actually work for you:

1. Don't tag a release.
2. Fix it on `dev`, merge to `main`, watch the draft rebuild.
3. Verify on your own machine by downloading from the draft's assets.