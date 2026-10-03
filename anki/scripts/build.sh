#!/usr/bin/env bash
# Package src/howsure into dist/howsure.ankiaddon (a zip with manifest.json at its top level).
set -euo pipefail
cd "$(dirname "$0")/.."
mkdir -p dist
rm -f dist/howsure.ankiaddon
(cd src/howsure && zip -r -q -D -X ../../dist/howsure.ankiaddon . \
  -x '*__pycache__*' '*.pyc' 'user_files/*' 'meta.json' '*.DS_Store')
echo "built $(pwd)/dist/howsure.ankiaddon"
