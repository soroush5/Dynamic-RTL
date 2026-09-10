#!/usr/bin/env bash
#
# build-zips.sh - reproducible packaging of all three Dynamic RTL builds.
#
# Output:
#   resources/dynamic-rtl-chrome-v<VERSION>.zip      (Chrome MV3 unpacked bundle)
#   resources/dynamic-rtl-firefox-v<VERSION>.zip     (Firefox MV3 unpacked bundle)
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

CHROME_VER="$(python3 -c "import json; print(json.load(open('chrome/manifest.json'))['version'])")"
FF_VER="$(python3 -c "import json; print(json.load(open('firefox/manifest.json'))['version'])")"

if [ "$CHROME_VER" != "$FF_VER" ]; then
  echo "Chrome ($CHROME_VER) and Firefox ($FF_VER) manifests disagree; aborting." >&2
  exit 1
fi

VERSION="$CHROME_VER"
echo "Packaging Dynamic RTL v${VERSION} (Chrome=${CHROME_VER}, Firefox=${FF_VER})"

mkdir -p resources

# --- Chrome ---
rm -f "resources/dynamic-rtl-chrome-v${VERSION}.zip"
(
  cd chrome
  zip -r -q -X \
    "../resources/dynamic-rtl-chrome-v${VERSION}.zip" \
    . \
    -x "*.DS_Store" "*/.*"
)

# --- Firefox ---
rm -f "resources/dynamic-rtl-firefox-v${VERSION}.zip"
(
  cd firefox
  zip -r -q -X \
    "../resources/dynamic-rtl-firefox-v${VERSION}.zip" \
    . \
    -x "*.DS_Store" "*/.*"
)

echo "Done:"
ls -lh resources/dynamic-rtl-*-v${VERSION}.zip
