# 🚀 Gyroclopter Release Guide

This document describes the complete release process for Gyroclopter, including automated changelog generation and multi-platform builds.

---

## Quick Release Checklist

```bash
# 1. Update version in package.json
# 2. Commit with conventional commit message
# 3. Tag the release
# 4. Push to trigger GitHub Actions
```

---

## Step-by-Step Release Process

### 1. Update Version

Edit `package.json` and update the version:

```json
{
  "name": "gyroclopter",
  "version": "0.5.0",  // ← Update this
  ...
}
```

### 2. Commit with Conventional Commit Message

Use the [Conventional Commits](https://www.conventionalcommits.org/) format:

```bash
# Examples:
git commit -m "feat: add Windows tray icon support"
git commit -m "fix: correct mouse sensitivity on high DPI displays"
git commit -m "docs: update installation instructions"
git commit -m "chore: update dependencies"
```

**Commit Types:**
- `feat:` - New features (appears in Features section)
- `fix:` - Bug fixes (appears in Bug Fixes section)
- `docs:` - Documentation changes
- `refactor:` - Code refactoring (no feature changes)
- `style:` - Formatting, no code changes
- `test:` - Adding or updating tests
- `chore:` - Maintenance tasks
- `build:` - Build system changes
- `ci:` - CI/CD configuration changes

### 3. Generate Changelog (Optional - Auto-generated in CI)

You can preview the changelog locally:

```bash
# Update changelog with recent commits
npm run changelog

# Or regenerate entire changelog
npm run changelog:all

# Review the changes
git diff CHANGELOG.md
```

### 4. Tag the Release

```bash
# Create annotated tag
git tag -a v0.5.0 -m "Release v0.5.0"

# Or lightweight tag
git tag v0.5.0
```

### 5. Push to GitHub

```bash
# Push code and tags
git push origin main
git push origin v0.5.0
```

### 6. GitHub Actions Takes Over

The `build-release.yml` workflow will:

1. ✅ Run tests on Ubuntu
2. ✅ Build Windows installer (on Windows runner)
3. ✅ Build Linux package (on Linux runner)
4. ✅ Auto-generate and update `CHANGELOG.md`
5. ✅ Create GitHub Release with:
   - Windows `.exe` installer
   - Linux `.deb` package
   - Release notes from commit history
   - Updated CHANGELOG.md

### 7. Verify Release

Check the [Releases page](https://github.com/ryanraposo/gyroclopter/releases) for:
- ✅ Release notes generated from commits
- ✅ Both Windows and Linux installers attached
- ✅ CHANGELOG.md updated in the release

---

## Local Development Workflow

### Pre-release Preparation

```bash
# 1. Ensure all tests pass
npm test

# 2. Build locally to verify
npm run build

# 3. Test the installers
# Windows: Run the .exe
# Linux: sudo dpkg -i dist/gyroclopter_*.deb
```

### Draft Releases

For testing before official release:

```bash
# Push to main without a tag
git push origin main
```

This creates a **draft release** tagged as `latest` that you can test before publishing.

---

## Changelog System Details

### Configuration Files

- `.changelogrc.json` - Changelog format configuration
- `scripts/changelog.sh` - Shell script for local generation
- `package.json` scripts:
  - `npm run changelog` - Update with recent commits
  - `npm run changelog:all` - Regenerate from scratch
  - `npm run release` - Update changelog and stage for commit

### How It Works

1. **Conventional Commits** are parsed from git history
2. **Categorized** by type (feat, fix, docs, etc.)
3. **Grouped** by version tags
4. **Formatted** with links to commits and issues
5. **Appended** to `CHANGELOG.md`

### Example Changelog Entry

```markdown
# [0.5.0](compare/v0.4.0...v0.5.0) (2026-06-30)

### Features

* add scroll support via wheel gestures ([abc1234](commit/abc1234))

### Bug Fixes

* correct mouse sensitivity on high DPI displays ([def5678](commit/def5678))
```

---

## Handling Mistakes

### Wrong Commit Message

If you committed with a non-conventional message:

```bash
# Amend the last commit
git commit --amend -m "feat: proper feature description"

# Or rebase to edit older commits
git rebase -i HEAD~5
```

### Incorrect Tag

```bash
# Delete local and remote tags
git tag -d v0.5.0
git push origin :refs/tags/v0.5.0

# Re-tag correctly
git tag -a v0.5.0 -m "Release v0.5.0"
git push origin v0.5.0
```

### Failed Build

Check GitHub Actions logs, fix the issue, then:

```bash
# Delete failed release
gh release delete v0.5.0 --cleanup-tag

# Fix and re-tag
git tag -d v0.5.0
git tag -a v0.5.0 -m "Release v0.5.0 (rebuild)"
git push origin v0.5.0
```

---

## Best Practices

1. **Commit Frequently** - Small, focused commits with clear messages
2. **Use Conventional Commits** - Makes changelogs automatic
3. **Test Before Tagging** - Use draft releases for verification
4. **Semantic Versioning** - Follow `MAJOR.MINOR.PATCH`
5. **Release Notes** - Let GitHub Actions auto-generate from commits

---

## Tools & Dependencies

- [`conventional-changelog-cli`](https://github.com/conventional-changelog/conventional-changelog) - Changelog generator
- [`softprops/action-gh-release`](https://github.com/softprops/action-gh-release) - GitHub Releases automation
- [`stefanzweifel/git-auto-commit-action`](https://github.com/stefanzweifel/git-auto-commit-action) - Auto-commit changelog

---

## Questions?

- [Conventional Commits Spec](https://www.conventionalcommits.org/)
- [Semantic Versioning](https://semver.org/)
- [GitHub Actions Docs](https://docs.github.com/en/actions)