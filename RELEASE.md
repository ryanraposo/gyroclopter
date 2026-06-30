# 🚀 Gyroclopter Release Guide

This document describes the complete release process for Gyroclopter, including manual changelog maintenance and multi-platform builds.

---

## Quick Release Checklist

```bash
# 1. Update version in package.json
# 2. Update CHANGELOG.md manually
# 3. Commit with conventional commit message
# 4. Tag the release
# 5. Push to trigger GitHub Actions
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

### 2. Update CHANGELOG.md

Edit `CHANGELOG.md` and add a new entry at the top (after the first line):

```markdown
## [0.5.1] - 2026-06-30

### Added
- New feature description

### Changed
- Modified behavior description

### Fixed
- Bug fix description

### Removed
- Removed feature description
```

Use the [Keep a Changelog](https://keepachangelog.com/) format with these sections:
- **Added** - New features
- **Changed** - Changes in existing functionality
- **Deprecated** - Soon-to-be removed features
- **Removed** - Removed features
- **Fixed** - Bug fixes
- **Security** - Security improvements

At the bottom of the file, add the version link:

```markdown
[0.5.1]: https://github.com/ryanraposo/gyroclopter/compare/v0.5.0...v0.5.1
```

**When to update:** Before every PR merge to `main`, group multiple commits into logical changes, use past tense ("Added", not "Add").

### 3. Commit with Conventional Commit Message

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
4. ✅ Create GitHub Release with:
   - Windows `.exe` installer
   - Linux `.deb` package
   - Release notes from commit history

### 7. Verify Release

Check the [Releases page](https://github.com/ryanraposo/gyroclopter/releases) for:
- ✅ Release notes generated from commits
- ✅ Both Windows and Linux installers attached

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
2. **Use Conventional Commits** - Makes release notes automatic
3. **Test Before Tagging** - Use draft releases for verification
4. **Semantic Versioning** - Follow `MAJOR.MINOR.PATCH`
5. **Release Notes** - Let GitHub Actions auto-generate from commits
6. **Manual Changelog** - Keep CHANGELOG.md human-readable with grouped changes

---

## Tools & Dependencies

- [`softprops/action-gh-release`](https://github.com/softprops/action-gh-release) - GitHub Releases automation
- [`stefanzweifel/git-auto-commit-action`](https://github.com/stefanzweifel/git-auto-commit-action) - Auto-commit changelog

---

## Questions?

- [Conventional Commits Spec](https://www.conventionalcommits.org/)
- [Semantic Versioning](https://semver.org/)
- [Keep a Changelog](https://keepachangelog.com/)
- [GitHub Actions Docs](https://docs.github.com/en/actions)