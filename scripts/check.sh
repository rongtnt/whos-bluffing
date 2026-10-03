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

say "anki: network code only in upload.py (opt-in sharing)"
hits=$(grep -rliE "\b(http|urllib|requests|socket)\b" "$root/anki/src" 2>/dev/null | sed "s#$root/##" | sort | tr '\n' ' ')
if [ "$hits" = "anki/src/howsure/upload.py " ] || [ -z "$hits" ]; then echo "ok: ${hits:-none}"; else echo "unexpected network reference in: $hits"; fail=1; fi


say "slack: tests"
( cd "$root/slack" && npm test --silent 2>&1 | grep -E "^# (tests|pass|fail)" ) || fail=1
( cd "$root/slack" && npm test --silent >/dev/null 2>&1 ) || { echo "slack tests failed"; fail=1; }

say "slack: dry-run deploy"
( cd "$root/slack" && npx wrangler deploy --dry-run --outdir dist >/dev/null 2>&1 && echo "dry-run ok" ) || { echo "dry-run failed"; fail=1; }

say "slack: no token/body logging"
if grep -rn "console.log(" "$root/slack/src" 2>/dev/null; then echo "console.log found"; fail=1; else echo "clean"; fi

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


say "daily schedule: live-file guard (5 ids/day, distinct categories, no reuse within 180 days)"
python3 - "$root" <<'PY' || fail=1
import json, sys, datetime as dt
root = sys.argv[1]
pool = json.load(open(f"{root}/items/pool.json")); items = pool["items"] if isinstance(pool, dict) else pool
cat = {i["id"]: i.get("category") for i in items}
sched = json.load(open(f"{root}/daily/schedule.json"))
last = {}; bad = []
for d in sorted(sched):
    ids = sched[d]
    if len(ids) != 5 or len(set(ids)) != 5: bad.append((d, "not 5 unique")); continue
    cats = [cat.get(i) for i in ids]
    if None in cats: bad.append((d, "unknown id")); continue
    if len(set(cats)) != 5: bad.append((d, "category repeated"))
    day = dt.date.fromisoformat(d)
    for i in ids:
        if i in last and (day - last[i]).days < 180: bad.append((d, f"{i} reused within 180d"))
        last[i] = day
print(len(sched), "days checked")
if bad: print("schedule problems:", bad[:10]); sys.exit(1)
print("schedule OK")
PY

say "result"; [ $fail -eq 0 ] && echo "ALL CHECKS PASSED" || { echo "FAILURES PRESENT"; exit 1; }
