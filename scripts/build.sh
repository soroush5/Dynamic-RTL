#!/usr/bin/env bash
# Builds chrome/, firefox/ and safari/ from src/, then zips them into resources/.
#   ./scripts/build.sh          folders and zips
#   ./scripts/build.sh --no-zip folders only
set -euo pipefail
cd "$(dirname "$0")/.."

for b in chrome firefox safari; do
  rm -rf "$b"
  cp -R src "$b"
  find "$b" -name .DS_Store -delete
done

python3 - <<'EOF'
import json

def patch(path, fn):
    with open(path) as f:
        m = json.load(f)
    fn(m)
    with open(path, "w") as f:
        json.dump(m, f, indent=2, ensure_ascii=False)
        f.write("\n")

def firefox(m):
    m["background"] = {"scripts": ["lib/store.js", "background.js"]}
    m["host_permissions"] = ["http://*/*", "https://*/*"]
    m["browser_specific_settings"] = {
        "gecko": {
            "id": "dynamic-rtl@soroush5.github.io",
            "strict_min_version": "128.0",
            "data_collection_permissions": {"required": ["none"]},
        }
    }

patch("firefox/manifest.json", firefox)
EOF

version="$(python3 -c "import json; print(json.load(open('src/manifest.json'))['version'])")"
echo "Built v$version"

[ "${1:-}" = "--no-zip" ] && exit 0

mkdir -p resources
for b in chrome firefox safari; do
  out="resources/dynamic-rtl-$b-v$version.zip"
  rm -f "$out"
  (cd "$b" && zip -rqX "../$out" .)
  cp "$out" "resources/dynamic-rtl-$b-latest.zip"
done
ls -lh resources/*-v"$version".zip
