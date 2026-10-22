# Contributing

- `main` holds releases; `dev` is the integration line.
- Keep at most one active feature branch and one feature PR targeting `dev`. Add related ongoing work to that branch. A temporary `dev` → `main` release PR is separate from feature work.
- Before retiring a branch, compare its current SHA with the merged PR head and check that all unique work is retained. A closed PR alone does not prove its branch is disposable.
- Run `npm test -- --runInBand`, `npm run build:icons`, `npm run web:build`, and `npm run web:verify` before committing platform changes.
- CI performs those checks in one `ubuntu-latest` job, with one dependency install, a timeout, and cancellation of superseded runs. Feature pushes are validated through their PR; permanent-branch pushes validate the integration/release result.
- Native Windows/Linux/macOS packaging is deliberate: use the manual build-artifacts workflow or a `v*` release tag. Ordinary PR updates do not launch native packaging.
- Before a release, update the package version and CHANGELOG, validate the native installers on their target systems, and follow `RELEASE.md`. Portable tests do not establish physical macOS or ChromeOS behavior.
- Keep a `Ryan:` section in the feature PR with only genuine owner decisions or hardware acceptance requirements. Keep evidence and unresolved limitations visible.
