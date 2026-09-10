#!/usr/bin/env bash
#
# build-zips.sh - reproducible packaging of all three Dynamic RTL builds.
#
# Output:
#   resources/dynamic-rtl-chrome-v<VERSION>.zip      (Chrome MV3 unpacked bundle)
#   resources/dynamic-rtl-firefox-v<VERSION>.zip     (Firefox MV3 unpacked bundle)
#   resources/dynamic-rtl-obsidian-v<VERSION>.zip    (Obsidian community plugin)
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

CHROME_VER="$(python3 -c "import json; print(json.load(open('chrome/manifest.json'))['version'])")"
FF_VER="$(python3 -c "import json; print(json.load(open('firefox/manifest.json'))['version'])")"
OBSIDIAN_VER="$(python3 -c "import json; print(json.load(open('obsidian/manifest.json'))['version'])")"

if [ "$CHROME_VER" != "$FF_VER" ]; then
  echo "Chrome ($CHROME_VER) and Firefox ($FF_VER) manifests disagree; aborting." >&2
  exit 1
fi

VERSION="$CHROME_VER"
echo "Packaging Dynamic RTL v${VERSION} (Chrome=${CHROME_VER}, Firefox=${FF_VER}, Obsidian=${OBSIDIAN_VER})"

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

# --- Obsidian ---
# Obsidian release zips conventionally tag with the plugin's own version,
# but we keep the v<VERSION> suffix consistent across all three artifacts.
rm -f "resources/dynamic-rtl-obsidian-v${VERSION}.zip"
(
  cd obsidian
  zip -r -q -X \
    "../resources/dynamic-rtl-obsidian-v${VERSION}.zip" \
    . \
    -x "*.DS_Store" "*/.*" "README.md"
)

echo "Done:"
ls -lh resources/dynamic-rtl-*-v${VERSION}.zip
