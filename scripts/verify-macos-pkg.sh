#!/usr/bin/env bash
set -euo pipefail
shopt -s nullglob

packages=(dist/*.pkg)
if [[ ${#packages[@]} -ne 1 ]]; then
  echo "Expected exactly one universal PKG, found ${#packages[@]}" >&2
  exit 1
fi
package="${packages[0]}"
version="$(node -p "require('./package.json').version")"
test "$(basename "$package")" = "Gyroclopter-${version}.pkg"

tmp="$(mktemp -d)"
trap 'rm -rf "$tmp"' EXIT
pkgutil --expand-full "$package" "$tmp/expanded"

app="$(find "$tmp/expanded" -type d -name 'Gyroclopter.app' -print -quit)"
test -n "$app"
test -f "$app/Contents/Info.plist"
test -f "$app/Contents/Resources/app.asar"
helper="$app/Contents/Resources/native/gyroclopter-mouse"
test -x "$helper"
lipo "$app/Contents/MacOS/Gyroclopter" -verify_arch arm64 x86_64
lipo "$helper" -verify_arch arm64 x86_64
"$helper" --self-test

if [[ "${VERIFY_MACOS_SIGNATURE:-0}" == 1 ]]; then
  codesign --verify --deep --strict "$app"
  codesign -dvv "$app" 2>&1 | grep '^Authority=Developer ID Application:'
  pkgutil --check-signature "$package" | grep 'Developer ID Installer:'
fi

# Verify the component installs into Applications, not an arbitrary path.
find "$tmp/expanded" -type f -name PackageInfo -exec grep -l 'install-location="/Applications"' {} + > "$tmp/install-locations"
test -s "$tmp/install-locations"
echo "Verified one universal installer: $package"
