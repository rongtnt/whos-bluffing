#!/usr/bin/env bash
# Smoke test: fresh local D1 + `wrangler pages dev`, then curl every endpoint. Exits non-zero on the first failure.
# Usage (from web/): bash test/smoke.sh        Needs `npm install` first (wrangler is the only devDependency).
set -euo pipefail
cd "$(dirname "$0")/.."

PORT=${PORT:-8798}
BASE="http://127.0.0.1:$PORT"
STATE=$(mktemp -d)
LOG="$STATE/dev.log"
WRANGLER=(npx --yes wrangler@4)
PASSED=0
DEV_PID=""

cleanup() {
  if [ -n "$DEV_PID" ]; then kill -TERM -- "-$DEV_PID" 2>/dev/null || true; wait "$DEV_PID" 2>/dev/null || true; fi
  rm -rf "$STATE"
}
trap cleanup EXIT

pass() { PASSED=$((PASSED + 1)); echo "PASS  $1"; }
fail() {
  echo "FAIL  $1"
  [ -n "${2:-}" ] && echo "      got: ${2:0:400}"
  echo "----- last lines of wrangler log -----"; tail -n 25 "$LOG" 2>/dev/null || true
  exit 1
}

# req METHOD PATH [JSON] -> sets STATUS, TYPE, BODY
req() {
  local args=(-s -X "$1" "$BASE$2" -w '\n%{http_code} %{content_type}')
  [ -n "${3:-}" ] && args+=(-H 'content-type: application/json' --data-binary "$3")
  local out
  out=$(curl "${args[@]}")
  local meta=${out##*$'\n'}
  BODY=${out%$'\n'*}
  STATUS=${meta%% *}
  TYPE=${meta#* }
}

# expect DESCRIPTION STATUS [JS expression over the parsed JSON body `r`]
expect() {
  [ "$STATUS" = "$2" ] || fail "$1 (status $STATUS, want $2)" "$BODY"
  if [ -n "${3:-}" ]; then
    printf '%s' "$BODY" | node -e 'const r = JSON.parse(require("fs").readFileSync(0, "utf8")); process.exit(eval(process.argv[1]) ? 0 : 1)' "$3" \
      || fail "$1 (check: $3)" "$BODY"
  fi
  pass "$1"
}

# submission LANG [VARIANT] [CLASS_CODE] -> a complete answer set built from the synced item bank
submission() {
  node -e '
    const [lang, variant = "ok", classCode = ""] = process.argv.slice(1);
    const items = JSON.parse(require("fs").readFileSync("public/items.json", "utf8")).items;
    const of = (t, n) => items.filter((i) => i.type === t).slice(0, n);
    const answers = [
      ...of("2afc", 12).map((i, k) => ({ id: i.id, choice: k % 3 ? i.answer : 1 - i.answer, conf: [50, 60, 70, 80, 90, 100][k % 6], rt_ms: 2500 })),
      ...of("interval", 6).map((i, k) => ({ id: i.id, low: i.answer * (k % 2 ? 0.5 : 2), high: i.answer * 3, rt_ms: 4000 })),
      ...of("attention", 2).map((i) => ({ id: i.id, choice: i.answer, conf: 100, rt_ms: 1800 })),
    ];
    if (variant === "badconf") answers[0].conf = 55;
    if (variant === "badrange") Object.assign(answers[12], { low: 10, high: 1 });
    if (variant === "short") answers.pop();
    const body = { lang, answers, website: variant === "honeypot" ? "http://spam.example" : "" };
    if (classCode) body.class_code = classCode;
    process.stdout.write(JSON.stringify(body));
  ' "$@"
}

field() { printf '%s' "$BODY" | node -e 'process.stdout.write(String(JSON.parse(require("fs").readFileSync(0, "utf8"))[process.argv[1]]))' "$1"; }

echo "== setup: sync items, migrate a fresh local D1 in $STATE"
node scripts/sync-items.js
"${WRANGLER[@]}" d1 migrations apply howsure --local --persist-to "$STATE" > "$STATE/migrate.log" 2>&1 \
  || { cat "$STATE/migrate.log"; fail "migrations apply --local"; }
pass "local D1 migrated"

set -m # own process group, so cleanup can stop wrangler and its workerd children together
"${WRANGLER[@]}" pages dev --ip 127.0.0.1 --port "$PORT" --persist-to "$STATE" > "$LOG" 2>&1 &
DEV_PID=$!
set +m
for _ in $(seq 1 120); do
  curl -fs -o /dev/null "$BASE/" 2>/dev/null && break
  kill -0 "$DEV_PID" 2>/dev/null || fail "wrangler pages dev exited early"
  sleep 1
done
curl -fs -o /dev/null "$BASE/" || fail "wrangler pages dev did not start within 120 s"
pass "wrangler pages dev is up on $BASE"

echo "== static pages"
for p in / /stats /class /class/d/AAAAAAAAAAAAAAAAAAAAAAAA /items.json /vendor/qrcode.js; do
  req GET "$p"; [ "$STATUS" = 200 ] || fail "GET $p (status $STATUS)"; pass "GET $p -> 200"
done

echo "== submit"
req POST /api/submit "$(submission en)"
expect "valid submit -> 200 with server-computed scores" 200 \
  'r.session_id && r.scores.acc === 0.666667 && r.scores.overconf === 0.083333 && r.scores.int_hit === 0.5 && r.bins.length === 6 && r.interval_detail.length === 6 && r.percentile === null && r.global.n_sessions === 1'
req POST /api/submit "$(submission en badconf)"
expect "bad conf -> 400" 400 '/conf/.test(r.error)'
req POST /api/submit "$(submission en badrange)"
expect "low > high -> 400" 400 '/range/.test(r.error)'
req POST /api/submit "$(submission en short)"
expect "wrong answer count -> 400" 400 '/expected/.test(r.error)'
req POST /api/submit "$(submission fr)"
expect "bad lang -> 400" 400 '/lang/.test(r.error)'
req POST /api/submit '{not json'
expect "invalid JSON -> 400" 400 'r.error === "invalid JSON"'

echo "== stats"
req GET /api/stats
expect "stats -> counts (passed sessions only)" 200 \
  'r.n_sessions === 1 && r.n_answers === 18 && r.by_lang.en.n === 1 && r.by_lang.zh.n === 0 && r.by_lang.en.bins.length === 6 && r.by_lang.en.overconf_mean === 0.083333 && r.updated_at'

echo "== class mode"
req POST /api/class '{"label":"Smoke test class"}'
expect "create class -> code, secret, links" 200 \
  '/^[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{6}$/.test(r.code) && /^[A-Za-z0-9_-]{24}$/.test(r.secret) && r.join_url.endsWith("/?c=" + r.code) && r.dashboard_url.endsWith("/class/d/" + r.secret)'
CODE=$(field code)
SECRET=$(field secret)
req GET "/api/class/$CODE"
expect "join: known code" 200 'r.exists === true && r.label === "Smoke test class"'
req GET /api/class/ZZZZZZ
expect "join: unknown code" 200 'r.exists === false'

req POST /api/submit "$(submission en honeypot "$CODE")"
[ "$STATUS" = 204 ] && [ -z "$BODY" ] || fail "honeypot -> 204 (status $STATUS)" "$BODY"
pass "honeypot -> 204, empty body"
req GET "/api/class/d/$SECRET"
expect "honeypot stored nothing (class count still 0)" 200 'r.n === 0 && Object.keys(r).length === 1'

for i in 1 2 3 4; do
  req POST /api/submit "$(submission en ok "$CODE")"; [ "$STATUS" = 200 ] || fail "class submit $i" "$BODY"
done
req GET "/api/class/d/$SECRET"
expect "dashboard below 5 -> only {n}" 200 'r.n === 4 && Object.keys(r).length === 1'
req GET "/api/class/d/$SECRET.csv"
CSV_BELOW=$'metric,bucket,n,value\nstudents,,4,\n'
[ "$STATUS" = 200 ] && [[ "$TYPE" == text/csv* ]] && [ "$BODY" = "$CSV_BELOW" ] || fail "csv below 5 -> count only" "$BODY"
pass "csv below 5 -> count only"

req POST /api/submit "$(submission en ok "$CODE")"; [ "$STATUS" = 200 ] || fail "class submit 5" "$BODY"
req GET "/api/class/d/$SECRET"
expect "dashboard at 5 -> aggregates, no rows" 200 \
  'r.n === 5 && r.bins.length === 6 && r.overconf_mean === 0.083333 && r.int_hit_mean === 0.5 && r.overconf_hist.reduce((s, h) => s + h.n, 0) === 5 && !("answers" in r) && !("sessions" in r)'
req GET "/api/class/d/$SECRET.csv"
[ "$STATUS" = 200 ] && [[ "$BODY" == *"students,,5,"* ]] && [[ "$BODY" == *"overconf_mean,,5,0.083333"* ]] || fail "csv at 5 -> aggregates" "$BODY"
pass "csv at 5 -> aggregates"
req GET /api/class/d/AAAAAAAAAAAAAAAAAAAAAAAA
expect "unknown dashboard secret -> 404" 404 'r.error'

echo "== percentile (needs 30 same-language passed sessions)"
for _ in $(seq 1 24); do
  req POST /api/submit "$(submission en)"; [ "$STATUS" = 200 ] || fail "filler submit" "$BODY"
done
req POST /api/submit "$(submission en)"
expect "percentile appears from n >= 30" 200 'r.percentile && r.percentile.overconf === 50 && r.percentile.int_hit === 50'
req POST /api/submit "$(submission zh)"
expect "zh session gets no percentile yet (n < 30 in zh)" 200 'r.percentile === null'

echo "smoke: $PASSED checks passed, 0 failed"
