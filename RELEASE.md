# Releasing Gyroclopter

`dev` integrates changes. `main` holds release commits. [CHANGELOG.md](CHANGELOG.md) holds the exact notes GitHub publishes for each version.

## While building

Add a short bullet under `Unreleased` for each user-facing change in the same PR. Use `Added`, `Changed`, `Deprecated`, `Removed`, `Fixed`, or `Security`. Describe the effect from the user's point of view and name the platform when it matters. Mark experimental work clearly and record acceptance separately in the PR. Skip notes for changes that users won't see.

```bash
npm run release:preview
npm run release:check
```

For Codex or Hermes, include this instruction in the task.

> Follow AGENTS.md. Target dev. Record user-facing changes under Unreleased, run the tests and release:check, and report the PR and verification. When I ask to prepare a release, use the version I give you, preview the notes, and open the dev → main PR. Leave the tag and publication to me unless I ask you to do those too.

## Prepare and review

1. Start with current `dev` and finish integrating the changes for this release. Review [platform acceptance](PLATFORM-ACCEPTANCE.md), including the experimental platforms and any outstanding device checks. Use the next version you want to ship. Here, `0.7.0` is an example.

   ```bash
   git switch dev
   git pull --ff-only
   npm run release:preview
   npm run release:prepare -- 0.7.0
   npm run --silent release:notes -- v0.7.0
   npm test

   git add CHANGELOG.md package.json package-lock.json
   git commit -m "chore: prepare v0.7.0"
   git push origin dev
   gh pr create --base main --head dev --title "Release v0.7.0" --body "See CHANGELOG.md for release notes."
   ```

2. In the PR's Actions runs, download the Windows and Linux artifacts from **Release installers** and the unsigned universal PKG from **macOS package**. Install the builds on available hardware and verify phone pairing and input as described in the platform docs. Keep the release scope fixed while the PR is in review.
3. Merge the PR into `main` after the checks and acceptance review. Use a merge commit so `main` retains the shared history with `dev`.

`release:prepare` moves the pending notes into a dated version entry and updates `package.json` and both lockfile version fields. It leaves the edits ready for review. CI validates metadata on every PR. The release PR also checks that the versioned notes are populated and `Unreleased` is empty.

## Tag and publish

Set the macOS signing secrets below before pushing the first tag. Once the release PR is merged, tag its merge commit on `main`. In this example `main` still points to that merge commit.

```bash
git switch main
git pull --ff-only
npm run --silent release:notes -- v0.7.0
git tag -a v0.7.0 -m "Release v0.7.0"
git push origin refs/tags/v0.7.0
```

GitHub Actions checks that the tag matches the package version and points to a commit on `main`. It verifies the Windows NSIS `.exe`, Linux amd64 `.deb`, and signed, notarized universal macOS `.pkg`. When all three pass, it creates or refreshes one draft on the [Releases page](https://github.com/ryanraposo/gyroclopter/releases), using the tagged changelog entry and attaching the installers and `SHA256SUMS.txt`.

Review the notes and the three downloads, then choose **Publish release** in GitHub or run `gh release edit v0.7.0 --draft=false` after the workflow succeeds. Microsoft Store submission runs through the [Windows Store workflow](WINDOWS-STORE.md). GitHub downloads use the NSIS installer for Windows.

### macOS signing setup

In the repository's **Settings → Secrets and variables → Actions**, add these repository secrets.

| Secret | Value |
| --- | --- |
| `CSC_LINK` / `CSC_KEY_PASSWORD` | Base64-encoded Developer ID Application `.p12` and its export password |
| `CSC_INSTALLER_LINK` / `CSC_INSTALLER_KEY_PASSWORD` | Base64-encoded Developer ID Installer `.p12` and its export password |
| `APPLE_ID` / `APPLE_APP_SPECIFIC_PASSWORD` / `APPLE_TEAM_ID` | Apple Developer account email, app-specific password, and team ID |

The release job verifies both signatures, submits the final PKG to Apple's notary service, and staples and validates the ticket before uploading it. PR builds use unsigned review packages.

### Retry a release

- If a runner, certificate setup, or Apple service fails, fix the problem and rerun the GitHub Actions run for the same tag. Rerun all jobs if the installer artifacts have expired.
- If the tagged source needs a code or changelog fix, prepare a higher version on `dev` and use the next release PR. Leave the existing tag in place. Keep the superseded draft unpublished.
