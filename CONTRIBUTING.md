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

* Builds the .deb package
* Reads version from package.json
* Creates a GitHub release
* Attaches build artifacts
* Publishes release notes from CHANGELOG.md

⸻

⚙️ Release Principle

* main = release trigger
* package.json = source of truth for version
* CHANGELOG.md = human-readable release narrative

No manual tagging is required in this workflow.

⸻

🚀 Golden Rule

If it lands on main, it ships.