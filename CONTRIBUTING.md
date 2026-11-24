# Contributing

1. Branch from current `dev` and open your feature or fix PR into `dev`.
2. Record each user-facing change under `Unreleased` in [CHANGELOG.md](CHANGELOG.md), grouped by the kind of change. Include a PR or issue link when it adds context. Internal maintenance can skip the changelog.
3. Run `npm test` and `npm run release:check` before committing. Use clear commit messages and include your verification in the PR.

Keep release preparation on `dev` and use a `dev` → `main` PR to promote the release. See [RELEASE.md](RELEASE.md) for the full workflow and [PLATFORM-ACCEPTANCE.md](PLATFORM-ACCEPTANCE.md) for platform acceptance.
