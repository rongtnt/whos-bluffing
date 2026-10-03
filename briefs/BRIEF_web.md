# Builder brief — HowSure web test v0.1

You are the executor. Build exactly this. If something here is impossible or wrong, do the smallest sensible thing and record it in `web/NOTES.md`. Do **not** change the design otherwise.

Hard rules: no git commits (leave the tree uncommitted). No `wrangler login`, no deploy, no purchases, no global installs. Edit only `web/` and `items/`. No IP/user-agent storage. No third-party scripts, fonts, analytics. No runtime npm dependencies (wrangler is the only devDependency). No "first/largest" claims and no mention of AI in user-facing copy. Chinese copy must read like a native wrote it.

## Goal
A free 5-minute bilingual (en/zh) web test of overconfidence: Cloudflare Pages (static, vanilla ES modules, no bundler) + Pages Functions (API) + D1. Mobile-first (most Chinese traffic is phones). Zero-friction: no account.

## Pinned stack
Node 22 (installed). `npx wrangler@4` for local dev and tests. Static frontend in `web/public`, API in `web/functions`, schema in `web/migrations/0001_init.sql`. `items/items.json` (repo root) is the single source of truth for questions; `node web/scripts/sync-items.js` copies it to `web/public/items.json` and `web/functions/_items.json` (both git-ignored). Never hand-edit the copies.

## Files
```
web/package.json            scripts: dev, test, smoke, sync-items, migrate:local
web/wrangler.toml           pages_build_output_dir="public"; [[d1_databases]] binding="DB" database_name="howsure"; compatibility_date
web/migrations/0001_init.sql
web/public/index.html app.js test.js results.js share.js class.js stats.js styles.css
web/public/i18n/en.json i18n/zh.json
web/public/vendor/qrcode.js   (vendored MIT QR encoder; cite source+license in NOTES.md)
web/functions/_metrics.js _items.json(generated) _util.js
web/functions/api/submit.js stats.js class/index.js class/[code].js class/d/[secret].js class/d/[secret].csv.js
web/scripts/sync-items.js
web/test/metrics.test.js     node:test against ../analysis/test_vectors.json
web/test/smoke.sh            starts `wrangler pages dev` with local D1, curls endpoints, non-zero exit on failure
web/README.md web/NOTES.md
items/items.json items/REVIEW.md   (schema: items/schema.json)
```

## D1 schema
`sessions(id TEXT PRIMARY KEY, created_at TEXT, lang TEXT, country TEXT, class_code TEXT, first_session_id TEXT, demographics TEXT, answers TEXT, n_2afc INTEGER, n_interval INTEGER, acc REAL, mean_conf REAL, overconf REAL, brier REAL, auroc REAL, int_hit REAL, passed_attention INTEGER, total_rt_ms INTEGER)` — one row per completed session (JSON blob for answers; scalar score columns for cheap aggregates).
`classes(code TEXT PRIMARY KEY, secret TEXT UNIQUE, label TEXT, created_at TEXT)`. Codes: 6 chars from `ABCDEFGHJKLMNPQRSTUVWXYZ23456789`; secrets: 24 chars.
Indexes on `sessions(lang, passed_attention)`, `sessions(class_code)`.

## API (JSON; errors `{error}` with 4xx; never leak stacks)
- `POST /api/submit` body `{lang, class_code?, first_session_id?, demographics?, answers:[{id, choice?, conf?, low?, high?, rt_ms}], website:""}`. `website` is a honeypot: non-empty → `204`, store nothing. Validate: lang ∈ {en,zh}; every id exists; 2afc `conf` ∈ {50,60,70,80,90,100} and `choice` ∈ {0,1}; interval `low ≤ high`, finite numbers; `rt_ms ≥ 0`; exactly the expected counts (12/6/2). Server recomputes all scores from `_items.json` (never trust client scores). `passed_attention` = both attention items correct. Country = `request.cf?.country ?? 'ZZ'`. Response `{session_id, scores:{acc, mean_conf, overconf, brier, auroc, int_hit, int_overconf}, bins, interval_detail:[{id, low, high, truth, hit}], percentile:{overconf, int_hit} | null (same-language passed sessions, null if n<30), global:{n_sessions, n_countries}}`.
- `GET /api/stats` → `{n_sessions, n_answers, n_countries, by_lang:{en:{n, overconf_mean, int_hit_mean, bins}, zh:{...}}, updated_at}`; passed sessions only; cache 60 s via Cache API.
- `POST /api/class {label?}` → `{code, secret, join_url, dashboard_url}`. `GET /api/class/:code` → `{exists, label}`.
- `GET /api/class/d/:secret` → `{n}` while n<5; otherwise `{n, bins, overconf_mean, int_hit_mean, overconf_hist}` — **aggregates only, never rows**. `GET /api/class/d/:secret.csv` → the same aggregates as CSV, same n≥5 rule.

## Frontend flow
1. Landing: language auto (navigator.language zh* → zh), visible toggle. Consent line (below). Buttons: Start · I teach — create a class code · Join a class (code input). URL `/?c=CODE` pre-fills the code.
2. 20 items, random order: 12 two-alternative items balanced across domains, 6 intervals, 2 attention checks placed at random positions 5–15. 2AFC screen: question → two option buttons → then six confidence buttons 50/60/70/80/90/100 with end labels (50% = coin flip, 100% = certain). Interval screen: "Give a range you are 90% sure contains the answer", low/high inputs with unit, validate low ≤ high and within the item's `accept` bounds (show a gentle message, do not block more than once). Progress indicator. Record `rt_ms` per item.
3. Optional demographics: four selects (age band, education, native language, region) with a prominent Skip.
4. Submit → results: plain headline sentences (below), overconfidence number explained, calibration chart (inline SVG: confidence vs accuracy with the diagonal), the 90%-range sentence, percentile when available, en-vs-zh comparison from `/api/stats`, and for bilinguals a CTA "Take it again in 中文 / English" → second run excludes seen ids and posts `first_session_id`. Share card: canvas → PNG, square 1080×1080 and landscape 1200×630, language-matched, with the headline, the URL and a QR code (vendored lib). Buttons: Download, Copy image (when supported), Copy link.
5. `/stats`: public counters + global curve. `/class`: create → shows code, join link, dashboard link, and a two-line instruction for projecting. `/class/d/<secret>`: polls every 10 s, inline SVG chart, CSV link, shows "Waiting for 5 students" until n ≥ 5.

## Copy (put all strings in the i18n files; plain words; expand yourself in the same register)
- Consent en: "5 minutes. Anonymous — no account, no tracking. Your answers go into a public research dataset. Close the page any time to stop." zh: "5 分钟。匿名，不用注册，不追踪。你的答案会进入一个公开的研究数据集。随时关掉页面即可退出。"
- Headlines en: "Your 90% ranges were right {k} of 6 times." / "You were {x} points more confident than you were right." zh: "你给的 90% 范围，6 次里有 {k} 次包含真实答案。" / "你的信心比你的正确率高了 {x} 个百分点。" (handle the underconfident case too.)

## Item bank (`items/items.json`, follow `items/schema.json`)
40 two-alternative + 20 interval + 2 attention items; `en` and `zh` ask exactly the same fact. Rules: stable facts (nothing that changes yearly); universal knowledge, not any country's school curriculum; geography and history spread evenly across continents and regions; metric units; every item has a `source` (URL or standard reference) and a `difficulty_hint` aimed at ⅓ easy, ⅓ medium, ⅓ hard; interval items have `accept` sanity bounds. Attention items are trivially obvious ("Which is larger: 100 or 10?"). Write `items/REVIEW.md`: one line per item — id · fact · source · `[ ]` — for the user's fact-check.

## Metrics (`functions/_metrics.js`, also imported by the frontend)
conf as probability 0.5–1.0: overconf = mean(conf) − mean(correct); brier = mean((conf−correct)²); auroc with ties = 0.5 and null when one class; bins per level {conf, n, acc}; int_hit = mean(low ≤ truth ≤ high) inclusive; int_overconf = 0.9 − int_hit. Must pass every case in `analysis/test_vectors.json` via `npm test`.

## Acceptance (run all before reporting)
1. `npm test` green.
2. `bash test/smoke.sh` green: migrate local D1; valid submit → 200 with scores; honeypot → 204 and no row; bad conf → 400; stats → counts; class create/join; dashboard returns `{n}` below 5 and aggregates after 5 submits with that code.
3. `grep -rniE "x-forwarded-for|user-agent|analytics|gtag|fonts.googleapis|cdn\." web/public web/functions` → nothing (NOTES.md excluded).
4. Layout works at 375 px (no horizontal scroll; 16 px gutters) — verify by CSS review.
5. `web/README.md`: run locally (3 commands), the user's deploy commands (login, d1 create, migrations apply --remote, pages deploy), manual checklist (10 lines).

## Report back (≤ 25 lines)
What exists, verbatim summary lines of `npm test` and `smoke.sh`, item counts per domain/difficulty, deviations (also in NOTES.md), open questions for the user.
