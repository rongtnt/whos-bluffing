#!/usr/bin/env bash
# Package src/whosbluffing into dist/whosbluffing.ankiaddon (a zip with manifest.json at its top level).
set -euo pipefail
cd "$(dirname "$0")/.."
mkdir -p dist
rm -f dist/whosbluffing.ankiaddon
(cd src/whosbluffing && zip -r -q -D -X ../../dist/whosbluffing.ankiaddon . \
  -x '*__pycache__*' '*.pyc' 'user_files/*' 'meta.json' '*.DS_Store')
echo "built $(pwd)/dist/whosbluffing.ankiaddon"
