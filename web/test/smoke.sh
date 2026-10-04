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

# req METHOD PATH [JSON] [HEADER] -> sets STATUS, TYPE, BODY
req() {
  local args=(-s -X "$1" "$BASE$2" -w '\n%{http_code} %{content_type}')
  [ -n "${3:-}" ] && args+=(-H 'content-type: application/json' --data-binary "$3")
  [ -n "${4:-}" ] && args+=(-H "$4")
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

# submission LANG [VARIANT] [CLASS_CODE] [ANON_ID] -> a complete answer set built from the synced item bank
submission() {
  node -e '
    const [lang, variant = "ok", classCode = "", anonId = ""] = process.argv.slice(1);
    const items = JSON.parse(require("fs").readFileSync("public/items.json", "utf8")).items;
    const of = (t, n) => items.filter((i) => i.type === t).slice(0, n);
    const LEVELS = [50, 60, 70, 80, 90, 100];
    // "mix:<m>" varies accuracy, confidence and range hits deterministically; the default is one fixed pattern.
    const m = variant.startsWith("mix:") ? Number(variant.slice(4)) : 0;
    const wrong = (j) => (m ? j % ((m % 4) + 2) === 0 : j % 3 === 0);
    const hit = (j) => (m ? (j + m) % ((m % 3) + 2) !== 0 : j % 2 === 1);
    const answers = [
      ...of("2afc", 12).map((i, j) => ({ id: i.id, choice: wrong(j) ? 1 - i.answer : i.answer, conf: LEVELS[m ? (j * m) % 6 : j % 6], rt_ms: 2500 })),
      ...of("interval", 6).map((i, j) => ({ id: i.id, low: i.answer * (hit(j) ? 0.5 : 2), high: i.answer * 3, rt_ms: 4000 })),
      ...of("attention", 2).map((i) => ({ id: i.id, choice: variant === "failatt" ? 1 - i.answer : i.answer, conf: 100, rt_ms: 1800 })),
    ];
    if (variant === "badconf") answers[0].conf = 55;
    if (variant === "badrange") Object.assign(answers[12], { low: 10, high: 1 });
    if (variant === "short") answers.pop();
    const body = { lang, answers, website: variant === "honeypot" ? "http://spam.example" : "" };
    if (classCode) body.class_code = classCode;
    if (anonId) body.anon_id = anonId;
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
KPI_KEY=smoke-kpi-key
"${WRANGLER[@]}" pages dev --ip 127.0.0.1 --port "$PORT" --persist-to "$STATE" --binding "KPI_KEY=$KPI_KEY" > "$LOG" 2>&1 &
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
for p in / /test /stats /class /class/d/AAAAAAAAAAAAAAAAAAAAAAAA /items.json /vendor/qrcode.js /site.js /home.js /styles.css; do
  req GET "$p"; [ "$STATUS" = 200 ] || fail "GET $p (status $STATUS)"; pass "GET $p -> 200"
done
# content PATH TEXT LABEL: 200 and the page's own text (a page can only be told apart from another by its content).
content() { req GET "$1"; [ "$STATUS" = 200 ] && [[ "$BODY" == *"$2"* ]] || fail "GET $1 should contain '$2' (status $STATUS)" "$BODY"; pass "GET $1 -> $3"; }
content / 'id="play"' 'home with the Play button'
content /test '<title>Full assessment' 'full assessment shell'
content /stats '<title>Live stats' 'stats shell'
content /class '<title>Create a class code' 'class shell'
content /class/d/AAAAAAAAAAAAAAAAAAAAAAAA '<script type="module" src="/app.js">' 'class dashboard (rewritten to the class shell, URL kept)'
content /slack '<h1 id="slack-title">HowSure for Slack</h1>' 'Slack page'
content /teachers '<a class="button primary" href="/class">' 'teachers page'
content /research '<h2 id="numbers">Numbers we publish</h2>' 'research page (definitions checked against PREREG in test/site.test.js)'
content /support 'What to include in a bug report' 'support page'
content /privacy '<h1 id="privacy">Privacy</h1>' 'privacy page (generated from PRIVACY.md)'
content /terms '<h1 id="terms-of-use">Terms of use</h1>' 'terms page (generated from TERMS.md)'
content /docs/api '<code>GET /api/daily?date=YYYY-MM-DD</code>' 'API docs (generated from docs/api-daily.md)'
content /tests/overconfidence-test '<title>Overconfidence test' 'SEO page'
content /tests/estimation-test '<title>Estimation test' 'SEO page'
content /tests/calibration-test '<title>Calibration test' 'SEO page'
content /sitemap.xml '<loc>https://howsure.me/tests/calibration-test</loc>' 'sitemap'
content /sitemap.xml '<loc>https://howsure.me/slack</loc>' 'sitemap lists the new pages'
content /robots.txt 'Sitemap: https://howsure.me/sitemap.xml' 'robots.txt'
req GET /no-such-page
[ "$STATUS" = 404 ] && [[ "$BODY" == *'<h1>Page not found</h1>'* ]] || fail "unknown path -> branded 404 (status $STATUS)" "$BODY"
pass "GET /no-such-page -> 404 with the branded 404.html"
for f in og.png:image/png favicon-32.png:image/png apple-touch-icon.png:image/png favicon.svg:image/svg+xml; do
  META=$(curl -s -o /dev/null -w '%{http_code} %{content_type}' "$BASE/${f%%:*}")
  [[ "$META" == "200 ${f#*:}"* ]] || fail "GET /${f%%:*} -> 200 ${f#*:}" "$META"; pass "GET /${f%%:*} -> 200 ${f#*:}"
done
req GET /pool.json
expect "GET /pool.json -> prompts only (no answers, sources or ranges)" 200 \
  'r.items.length >= 1500 && r.items.every((i) => Object.keys(i).sort().join() === "category,id,prompt,unit")'

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
req POST /api/submit "$(submission zh)"
expect "zh -> 400 (English only)" 400 'r.error === "lang must be en"'
req POST /api/submit '{not json'
expect "invalid JSON -> 400" 400 'r.error === "invalid JSON"'

echo "== stats"
req GET /api/stats
expect "stats -> counts (passed sessions only)" 200 \
  'r.n_sessions === 1 && r.n_answers === 18 && r.by_lang.en.n === 1 && !("zh" in r.by_lang) && r.by_lang.en.bins.length === 6 && r.by_lang.en.overconf_mean === 0.083333 && r.updated_at'

echo "== class mode"
req POST /api/class '{"label":"Smoke test class"}'
expect "create class -> code, secret, links" 200 \
  '/^[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{6}$/.test(r.code) && /^[A-Za-z0-9_-]{24}$/.test(r.secret) && r.join_url.endsWith("/test?c=" + r.code) && r.dashboard_url.endsWith("/class/d/" + r.secret)'
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

echo "== aggregates match a direct computation over the sessions table"
for m in $(seq 1 12); do
  req POST /api/submit "$(submission en "mix:$m")"; [ "$STATUS" = 200 ] || fail "varied en submit $m" "$BODY"
done
for _ in 1 2; do
  req POST /api/submit "$(submission en failatt)"; [ "$STATUS" = 200 ] || fail "attention-failing submit" "$BODY"
done
req POST /api/submit "$(submission en mix:5)"
expect "probe session gets a percentile" 200 'r.percentile !== null'
printf '%s' "$BODY" > "$STATE/probe.json"
# /api/stats is cached for 60 s per URL; asking through another host name returns a fresh read of the aggregates.
curl -s "http://localhost:$PORT/api/stats" > "$STATE/fresh.json"
"${WRANGLER[@]}" d1 execute howsure --local --persist-to "$STATE" --json --command \
  "SELECT id, lang, country, n_2afc, n_interval, overconf, int_hit, passed_attention, answers FROM sessions; EXPLAIN QUERY PLAN SELECT overconf, int_hit, answers FROM sessions WHERE class_code = 'ABC234'" \
  > "$STATE/direct.json" 2>/dev/null || fail "d1 execute (direct read of the sessions table)"
DIRECT=$(node -e '
  const fs = require("fs");
  const read = (f) => JSON.parse(fs.readFileSync(`${process.argv[1]}/${f}`, "utf8"));
  const probe = read("probe.json");
  const fresh = read("fresh.json");
  const rows = read("direct.json")[0].results;
  const r6 = (x) => Math.round(x * 1e6) / 1e6;
  const mean = (xs) => xs.reduce((a, b) => a + b, 0) / xs.length;
  const passed = rows.filter((r) => r.passed_attention === 1);
  const expected = {
    n_sessions: passed.length,
    n_answers: passed.reduce((s, r) => s + r.n_2afc + r.n_interval, 0),
    n_countries: new Set(passed.map((r) => r.country).filter((c) => !["ZZ", "XX", "T1"].includes(c))).size,
    by_lang: {},
  };
  for (const lang of ["en"]) {
    const L = passed.filter((r) => r.lang === lang);
    const two = L.flatMap((r) => JSON.parse(r.answers)).filter((a) => a.type === "2afc");
    expected.by_lang[lang] = {
      n: L.length,
      overconf_mean: L.length ? r6(mean(L.map((r) => r.overconf))) : null,
      int_hit_mean: L.length ? r6(mean(L.map((r) => r.int_hit))) : null,
      bins: [50, 60, 70, 80, 90, 100].map((c) => {
        const g = two.filter((a) => a.conf === c);
        return { conf: c / 100, n: g.length, acc: g.length ? r6(mean(g.map((a) => a.correct))) : null };
      }),
    };
  }
  const diffs = [];
  const cmp = (got, want, path) => {
    if (typeof want === "number" && typeof got === "number") { if (Math.abs(got - want) > 2e-6) diffs.push(`${path}: ${got} vs ${want}`); return; }
    if (want && typeof want === "object") { for (const k of Object.keys(want)) cmp(got?.[k], want[k], `${path}.${k}`); return; }
    if (got !== want) diffs.push(`${path}: ${got} vs ${want}`);
  };
  cmp(fresh, expected, "stats");
  // Percentile: mid-rank on the same bins, over the other passed English sessions.
  const ocBin = (x) => Math.max(-10, Math.min(10, Math.round(x * 20))) + 0;
  const ihBin = (x) => Math.round(x * 6);
  const others = passed.filter((r) => r.lang === "en" && r.id !== probe.session_id);
  const midRank = (vals, mine) => Math.round((100 * (vals.filter((v) => v < mine).length + vals.filter((v) => v === mine).length / 2)) / vals.length);
  cmp(probe.percentile, {
    overconf: midRank(others.map((r) => ocBin(r.overconf)), ocBin(probe.scores.overconf)),
    int_hit: midRank(others.map((r) => ihBin(r.int_hit)), ihBin(probe.scores.int_hit)),
  }, "percentile");
  if (rows.length - passed.length < 2) diffs.push("attention-failing sessions should be stored");
  if (diffs.length) { console.log(diffs.join("; ")); process.exit(1); }
  console.log(`${passed.length} passed, ${rows.length - passed.length} failed and excluded, probe percentile ${probe.percentile.overconf}/${probe.percentile.int_hit}`);
' "$STATE") || fail "aggregates vs direct computation" "$DIRECT"
pass "stats and percentile from the aggregates match the sessions table ($DIRECT)"
node -e 'const r = JSON.parse(require("fs").readFileSync(process.argv[1], "utf8"))[1].results; process.exit(r.some((x) => /USING INDEX idx_sessions_class/.test(x.detail)) ? 0 : 1)' "$STATE/direct.json" \
  || fail "class dashboard query should use idx_sessions_class"
pass "class dashboard query uses idx_sessions_class (reads only that class)"

echo "== daily game"
TODAY=$(date -u +%F)
TOMORROW=$(node -e 'process.stdout.write(new Date(Date.now() + 864e5).toISOString().slice(0, 10))')
export TODAY DAILY="$STATE/daily.json"
node -e 'process.exit(require("./functions/_schedule.json")[process.argv[1]] ? 0 : 1)' "$TODAY" \
  || fail "no daily game scheduled for $TODAY: run npm run schedule, then npm run sync-items"
pass "today ($TODAY) is in daily/schedule.json"

req GET /api/daily
expect "GET /api/daily -> today's 5 items, prompts only (no answers or sources)" 200 \
  'r.date === process.env.TODAY && Number.isInteger(r.number) && r.items.length === 5 && r.items.every((i) => Object.keys(i).sort().join() === "accept,id,prompt,unit") && !/wikidata|"answer"|"source"/.test(JSON.stringify(r))'
printf '%s' "$BODY" > "$DAILY"
req GET "/api/daily?date=$TOMORROW"
expect "GET /api/daily for tomorrow -> 404 (never early)" 404 'r.error === "no game for that date"'

# answer_body ANON SURFACE K HIT(1|0) [COMMUNITY] -> body for item K of today's game: a range around the truth or above it
answer_body() {
  node -e '
    const fs = require("fs");
    const [anon, surface, k, hit, community] = process.argv.slice(1);
    const day = JSON.parse(fs.readFileSync(process.env.DAILY, "utf8"));
    const pool = new Map(JSON.parse(fs.readFileSync("functions/_pool.json", "utf8")).items.map((i) => [i.id, i]));
    const t = pool.get(day.items[Number(k)].id).answer;
    const w = Math.abs(t) + 1;
    const [low, high] = hit === "1" ? [t - w, t + w] : [t + w, t + 2 * w];
    const body = { date: day.date, item_id: day.items[Number(k)].id, low, high, anon_id: anon, surface, rt_ms: 3000 };
    if (community) body.community = community;
    process.stdout.write(JSON.stringify(body));
  ' "$@"
}
complete_body() { node -e 'const [a, s, c] = process.argv.slice(1); const b = { date: process.env.TODAY, anon_id: a, surface: s }; if (c) b.community = c; process.stdout.write(JSON.stringify(b))' "$@"; }

# play ANON SURFACE HITS(e.g. 11011) [COMMUNITY]: answers all 5 items, then completes (response in BODY)
play() {
  for k in 0 1 2 3 4; do
    req POST /api/daily/answer "$(answer_body "$1" "$2" "$k" "${3:$k:1}" "${4:-}")"
    [ "$STATUS" = 200 ] || fail "answer $k for $1" "$BODY"
  done
  req POST /api/daily/complete "$(complete_body "$1" "$2" "${4:-}")"
}

ANON_A=smokeAAAAAAAAAAAAAAAAA
ANON_B=smokeBBBBBBBBBBBBBBBBB
ANON_C=$(printf 'smoke-slack-member' | shasum -a 256 | cut -c1-64) # Slack ids are sha256 hex
req POST /api/daily/complete "$(complete_body "$ANON_A" web)"
expect "complete before answering -> 400" 400 'r.error === "answer every question first"'
req POST /api/daily/answer "$(answer_body "$ANON_A" web 0 1)"
expect "answer -> server-computed hit, truth, Wikidata source, log ratio error" 200 \
  'r.hit === true && typeof r.truth === "number" && /^https:\/\/www\.wikidata\.org\/wiki\/Q\d+#P\d+$/.test(r.source) && "log_ratio_error" in r'
FIRST_ANSWER=$BODY
play "$ANON_A" web 11011
expect "complete (web, 4 hits) -> 4/5, streak 1, share text in the brief's format" 200 \
  'r.hits === 4 && r.n === 5 && r.streak === 1 && /^HowSure #-?\d+ 🟩🟩🟥🟩🟩 4\/5 at 90%\nToday\x27s average 4\.0\/5\nhttp:\/\/127\.0\.0\.1:\d+\/$/.test(r.share_text) && r.today.players === 1'
play "$ANON_B" web 10010
expect "complete (web, 2 hits)" 200 'r.hits === 2 && r.today.players === 2'
play "$ANON_C" slack 00000 smoke-team-hash
expect "complete (slack + community, 0 hits) -> today's histogram over 3 players" 200 \
  'r.hits === 0 && r.today.players === 3 && r.today.avg_hits === 2 && r.today.hist.join() === "1,0,1,0,1,0"'

req GET "/api/daily/stats?date=$TODAY"
expect "GET /api/daily/stats -> players 3, average 2, histogram [1,0,1,0,1,0]" 200 \
  'r.players === 3 && r.avg_hits === 2 && r.hist.join() === "1,0,1,0,1,0"'
req POST /api/daily/answer "$(answer_body "$ANON_A" web 0 0)"
[ "$STATUS" = 200 ] && [ "$BODY" = "$FIRST_ANSWER" ] || fail "second answer -> the first result" "$BODY"
pass "second answer (different range) -> the first result, unchanged"
req POST /api/daily/complete "$(complete_body "$ANON_A" web)"
expect "second complete -> same play, not counted again" 200 'r.hits === 4 && r.streak === 1 && r.today.players === 3'
req POST /api/daily/answer "$(answer_body "$ANON_A" web 0 1 | node -e 'const b = JSON.parse(require("fs").readFileSync(0, "utf8")); b.date = process.argv[1]; process.stdout.write(JSON.stringify(b))' "$TOMORROW")"
expect "answer for tomorrow -> 400 (today or yesterday only)" 400 'r.error === "date must be today or yesterday (UTC)"'
req POST /api/daily/answer "$(answer_body "$ANON_A" web 1 1 | node -e 'const b = JSON.parse(require("fs").readFileSync(0, "utf8")); b.low = b.high + 1; process.stdout.write(JSON.stringify(b))')"
expect "answer with low > high -> 400" 400 '/low <= high/.test(r.error)'

echo "== flag -> retire -> recompute"
FLAGGED=$(node -e 'process.stdout.write(JSON.parse(require("fs").readFileSync(process.env.DAILY, "utf8")).items[1].id)')
flag_body() { printf '{"item_id":"%s","anon_id":"%s","reason":"smoke test"}' "$FLAGGED" "$1"; }
req POST /api/flag "$(flag_body smokeDDDDDDDDDDDDDDDDD)"
expect "flag from someone who never answered it -> 403" 403 '/answer this question/.test(r.error)'
req POST /api/flag "$(flag_body "$ANON_A")"; expect "flag 1 (A)" 200 'r.ok === true'
req POST /api/flag "$(flag_body "$ANON_A")"; expect "same id again counts once" 200 'r.ok === true'
req POST /api/flag "$(flag_body "$ANON_B")"; expect "flag 2 (B)" 200 'r.ok === true'
req GET /api/daily
expect "two flags: item still in the game" 200 'r.items.length === 5'
req POST /api/flag "$(flag_body "$ANON_C")"; expect "flag 3 (C) retires the item" 200 'r.ok === true'
req GET /api/daily
expect "retired item left out of today's game" 200 "r.items.length === 4 && !r.items.some((i) => i.id === '$FLAGGED')"
# /api/daily/stats is cached for 60 s per URL; asking through another host name reads the recomputed aggregates.
STATUS=$(curl -s -o "$STATE/stats2.json" -w '%{http_code}' "http://localhost:$PORT/api/daily/stats?date=$TODAY"); BODY=$(cat "$STATE/stats2.json")
expect "stats recomputed without the retired item (4->3, 2->2, 0->0)" 200 'r.players === 3 && r.avg_hits === 1.67 && r.hist.join() === "1,0,1,1,0,0"'
req POST /api/daily/complete "$(complete_body "$ANON_A" web)"
expect "A's result now counts 4 items" 200 'r.hits === 3 && r.n === 4 && /🟩🟥🟩🟩 3\/4 at 90%/.test(r.share_text)'

echo "== KPI job"
req POST /api/submit "$(submission en ok '' "$ANON_A")"
expect "full assessment with A's browser id (MAU must count A once)" 200 'r.session_id'
req POST /api/kpi/run
expect "KPI run without the key -> 401" 401 'r.error === "unauthorized"'
req POST /api/kpi/run '' 'x-kpi-key: wrong'
expect "KPI run with a wrong key -> 401" 401 'r.error === "unauthorized"'
req POST /api/kpi/run '' "x-kpi-key: $KPI_KEY"
expect "KPI run with the key -> MAU 3 (web 2, slack 1), DAU 3, workspaces 1, classrooms 1" 200 \
  'r.as_of === process.env.TODAY && r.mau === 3 && r.dau === 3 && r.mau_web === 2 && r.mau_slack === 1 && r.mau_classroom === 0 && r.workspaces === 1 && r.classrooms === 1'
req GET /api/kpi
expect "GET /api/kpi -> the stored row" 200 \
  'r.as_of === process.env.TODAY && r.mau === 3 && r.dau === 3 && r.mau_by_surface.web === 2 && r.mau_by_surface.slack === 1 && r.communities.workspaces === 1 && r.communities.classrooms === 1'

echo "== daily tables: counts, idempotency, no IP or user agent, request queries use indexes"
"${WRANGLER[@]}" d1 execute howsure --local --persist-to "$STATE" --json --command \
  "SELECT (SELECT COUNT(*) FROM daily_answers) AS answers, (SELECT COUNT(*) FROM plays) AS plays, (SELECT n_answers FROM items_runtime WHERE item_id = '$(node -e 'process.stdout.write(JSON.parse(require("fs").readFileSync(process.env.DAILY, "utf8")).items[0].id)')') AS first_item_answers, (SELECT community FROM players WHERE surface = 'slack') AS team;
   SELECT name, sql FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%' AND name NOT LIKE '_cf_%';
   EXPLAIN QUERY PLAN SELECT surface, players, hits_hist, patterns FROM daily_agg WHERE date = '2026-10-20';
   EXPLAIN QUERY PLAN SELECT item_id, hit FROM daily_answers WHERE anon_id = 'x' AND date = '2026-10-20';
   EXPLAIN QUERY PLAN SELECT hits, n, streak FROM plays WHERE anon_id = 'x' AND date = '2026-10-20' ORDER BY completed_at LIMIT 1;
   EXPLAIN QUERY PLAN SELECT item_id FROM items_runtime WHERE retired_at IS NOT NULL AND item_id IN ('a', 'b', 'c', 'd', 'e')" \
  > "$STATE/daily_db.json" 2>/dev/null || fail "d1 execute (daily tables)"
CHECK=$(node -e '
  const out = JSON.parse(require("fs").readFileSync(process.argv[1], "utf8"));
  const [counts, tables, ...plans] = out.map((x) => x.results);
  const c = counts[0];
  const problems = [];
  if (c.answers !== 15 || c.plays !== 3) problems.push(`answers ${c.answers}, plays ${c.plays}`);
  if (c.first_item_answers !== 3) problems.push(`items_runtime counted ${c.first_item_answers} answers for item 1 (repeat answers must not count)`);
  if (c.team !== "smoke-team-hash") problems.push(`slack community ${c.team}`);
  const sneaky = tables.filter((t) => /\b(ip|ip_address|ip_hash|user_agent|ua|useragent)\b/i.test(t.sql)).map((t) => t.name);
  if (sneaky.length) problems.push(`IP/UA-like columns in: ${sneaky}`);
  if (tables.length < 13) problems.push(`only ${tables.length} tables`);
  plans.forEach((p, i) => { const d = p.map((x) => x.detail).join(" | "); if (!/SEARCH/.test(d) || /SCAN/.test(d)) problems.push(`plan ${i}: ${d}`); });
  if (problems.length) { console.log(problems.join("; ")); process.exit(1); }
  console.log(`${c.answers} answers, ${c.plays} plays, ${tables.length} table definitions without IP/UA columns, ${plans.length} request queries use an index`);
' "$STATE/daily_db.json") || fail "daily tables" "$CHECK"
pass "daily tables ($CHECK)"

echo "== anki add-on sharing (v0.2): submit twice, stats, KPI, delete, 410"
ANKI_ID=$(printf 'smoke-anki-install' | shasum -a 256 | cut -c1-64) # the add-on sends its salt hashed again: 64-char hex
# anki_body INSTALL_ID [ROWS] [cardtext] -> a submit body with ROWS rows (row_id 1..ROWS) of whitelisted fields
anki_body() {
  node -e '
    const [id, n = "3", extra = ""] = process.argv.slice(1);
    const hex = (c) => c.repeat(64);
    const rows = Array.from({ length: Number(n) }, (_, i) => ({
      row_id: i + 1, card_hash: hex("1"), deck_hash: hex("2"), jol: (i % 5) + 1, ease: (i % 4) + 1, q_rt_ms: 1500,
      a_rt_ms: 800, ivl_days: 12, days_since_last_review: 3.5, stability: 10.5, difficulty: 5.1, retrievability: 0.9,
      anki_version: "26.09.3", addon_version: "0.2.0" }));
    if (extra === "cardtext") rows[0].front = "What is the capital of France?";
    process.stdout.write(JSON.stringify({ install_id: id, addon_version: "0.2.0", consent_version: "1", rows }));
  ' "$@"
}
req POST /api/anki/submit "$(anki_body "$ANKI_ID")"
expect "anki submit 3 rows -> 3 accepted" 200 'r.accepted === 3 && r.duplicates === 0 && r.total_rows_for_install === 3'
req POST /api/anki/submit "$(anki_body "$ANKI_ID")"
expect "the same 3 rows again -> all duplicates" 200 'r.accepted === 0 && r.duplicates === 3 && r.total_rows_for_install === 3'
req POST /api/anki/submit "$(anki_body "$ANKI_ID" 3 cardtext)"
expect "a row with an extra field (card text) -> 400" 400 'r.error === "row 0: unknown field front"'
req GET /api/anki/stats
expect "GET /api/anki/stats -> 1 install, 3 rows" 200 'r.installs_30d === 1 && r.rows_total === 3'
req POST /api/kpi/run '' "x-kpi-key: $KPI_KEY"
expect "KPI run -> anki_contributors_30d 1, MAU still 3 (Anki is not part of MAU)" 200 'r.anki_contributors_30d === 1 && r.mau === 3'
req GET /api/kpi
expect "GET /api/kpi -> anki_contributors_30d as its own number" 200 'r.anki_contributors_30d === 1 && r.mau === 3 && r.mau_by_surface.web === 2'
anki_body "$(printf 'smoke-anki-big' | shasum -a 256 | cut -c1-64)" 2000 > "$STATE/anki_big.json"
STATUS=$(curl -s -o "$STATE/anki_big_out.json" -w '%{http_code}' -H 'content-type: application/json' --data-binary "@$STATE/anki_big.json" "$BASE/api/anki/submit"); BODY=$(cat "$STATE/anki_big_out.json")
expect "a full 2,000-row request ($(wc -c < "$STATE/anki_big.json" | tr -d ' ') bytes) -> 2000 accepted" 200 'r.accepted === 2000 && r.total_rows_for_install === 2000'
req POST /api/anki/delete "{\"install_id\":\"$ANKI_ID\"}"
expect "delete -> 3 rows deleted" 200 'r.deleted_rows === 3'
req POST /api/anki/delete "{\"install_id\":\"$ANKI_ID\"}"
expect "delete again -> 0 (idempotent)" 200 'r.deleted_rows === 0'
# /api/anki/stats is cached for 60 s per URL; asking through another host name reads the aggregates again.
STATUS=$(curl -s -o "$STATE/anki_stats.json" -w '%{http_code}' "http://localhost:$PORT/api/anki/stats"); BODY=$(cat "$STATE/anki_stats.json")
expect "stats after the delete -> only the 2,000-row install is left" 200 'r.installs_30d === 1 && r.rows_total === 2000'
req POST /api/anki/submit "$(anki_body "$ANKI_ID")"
expect "submit after delete -> 410" 410 'r.error === "data deleted for this installation"'
"${WRANGLER[@]}" d1 execute howsure --local --persist-to "$STATE" --json --command \
  "SELECT (SELECT COUNT(*) FROM anki_rows WHERE install_id = '$ANKI_ID') AS rows_left, (SELECT SUM(installs) FROM anki_agg) AS installs, (SELECT SUM(rows) FROM anki_agg) AS agg_rows, (SELECT rows FROM anki_installs WHERE install_id = '$ANKI_ID') AS install_rows, (SELECT deleted_at IS NOT NULL AND first_seen IS NULL AND consent_version IS NULL FROM anki_installs WHERE install_id = '$ANKI_ID') AS tombstone_only, (SELECT COUNT(*) FROM anki_rows) AS all_rows" \
  > "$STATE/anki_db.json" 2>/dev/null || fail "d1 execute (anki tables)"
CHECK=$(node -e '
  const c = JSON.parse(require("fs").readFileSync(process.argv[1], "utf8"))[0].results[0];
  const ok = c.rows_left === 0 && c.installs === 1 && c.agg_rows === 2000 && c.install_rows === 0 && c.tombstone_only === 1 && c.all_rows === 2000;
  console.log(JSON.stringify(c)); process.exit(ok ? 0 : 1);
' "$STATE/anki_db.json") || fail "anki tables after delete + 410" "$CHECK"
pass "after delete and the refused upload: no rows for the install, aggregates exact, tombstone holds only the id ($CHECK)"

echo "smoke: $PASSED checks passed, 0 failed"
