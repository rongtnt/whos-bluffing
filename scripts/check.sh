#!/usr/bin/env bash
# Repo-wide acceptance check. Exit non-zero on any failure.
set -u
root="$(cd "$(dirname "$0")/.." && pwd)"; fail=0
say(){ printf '\n== %s ==\n' "$*"; }

say "web: metrics vectors"
( cd "$root/web" && npm test --silent ) || fail=1

say "web: smoke (local wrangler + D1)"
if [ -f "$root/web/test/smoke.sh" ]; then ( cd "$root/web" && bash test/smoke.sh ) || fail=1; else echo "missing web/test/smoke.sh"; fail=1; fi

say "web: forbidden strings"
if grep -rniE "x-forwarded-for|user-agent|analytics|gtag|fonts\.googleapis|cdn\." "$root/web/public" "$root/web/functions" 2>/dev/null | grep -v "_items.json"; then echo "forbidden string found"; fail=1; else echo "clean"; fi

say "anki: pytest"
( cd "$root/anki" && uv run pytest -q tests ) || fail=1

say "anki: build"
( cd "$root/anki" && bash scripts/build.sh && unzip -l dist/howsure.ankiaddon | grep -q " manifest.json$" && echo "manifest at top level" ) || fail=1

say "anki: no network code"
if grep -rniE "\b(http|urllib|requests|socket)\b" "$root/anki/src" 2>/dev/null; then echo "network reference found"; fail=1; else echo "clean"; fi

say "items: counts"
python3 - "$root/items/items.json" <<'PY' || fail=1
import json, sys, collections
p = sys.argv[1]
try:
    d = json.load(open(p))
except FileNotFoundError:
    print("items.json missing"); sys.exit(1)
items = d["items"]; by = collections.Counter(i["type"] for i in items)
print(dict(by)); print("domains", dict(collections.Counter(i["domain"] for i in items)))
print("difficulty", dict(collections.Counter(i.get("difficulty_hint") for i in items)))
missing_src = [i["id"] for i in items if not i.get("source")]
assert by["2afc"] == 40 and by["interval"] == 20 and by["attention"] == 2, by
assert not missing_src, missing_src
for i in items:
    assert i["en"]["prompt"] and i["zh"]["prompt"], i["id"]
print("items OK")
PY

say "result"; [ $fail -eq 0 ] && echo "ALL CHECKS PASSED" || { echo "FAILURES PRESENT"; exit 1; }
