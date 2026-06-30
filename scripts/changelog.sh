#!/bin/bash
#
# Generate/update CHANGELOG.md from git commit history
# Usage: ./scripts/changelog.sh [VERSION]
#
# If VERSION is provided, creates a new section for that version.
# If not, updates the current changelog with all commits.
#

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(dirname "$SCRIPT_DIR")"
CHANGELOG="$ROOT_DIR/CHANGELOG.md"

cd "$ROOT_DIR"

# Install conventional-changelog if not present
if ! command -v conventional-changelog &> /dev/null; then
    echo "Installing conventional-changelog-cli..."
    npm install -g conventional-changelog-cli
fi

echo "📝 Generating CHANGELOG.md..."

if [ -n "$1" ]; then
    VERSION="$1"
    echo "  Version: $VERSION"
    
    # Generate with version header
    conventional-changelog \
        -p angular \
        -i CHANGELOG.md \
        -s \
        -r 0 \
        --release-count 0
    
    echo "  ✓ CHANGELOG.md updated with $VERSION"
else
    echo "  Regenerating entire changelog..."
    
    # Regenerate from scratch
    conventional-changelog \
        -p angular \
        -i CHANGELOG.md \
        -s \
        -r 0
    
    echo "  ✓ CHANGELOG.md regenerated"
fi

# Show the last 20 lines
echo ""
echo "=== Last 20 lines of CHANGELOG.md ==="
tail -20 CHANGELOG.md