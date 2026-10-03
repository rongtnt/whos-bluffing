# Builder notes — web test v0.1

## Deviations from the brief (smallest sensible change each)

1. **No `functions/api/class/d/[secret].csv.js`.** Wrangler orders `/api/class/d/:secret` before `/api/class/d/:secret.csv` and runs only the first match, so the CSV route was unreachable (`next()` falls through to static assets; verified with wrangler 4.147.0). `[secret].js` serves the CSV when the path ends in `.csv`. The URL is unchanged.
2. **Metrics live in `public/metrics.js`;** `functions/_metrics.js` re-exports it, so the API, the browser and the tests use one file (the browser cannot load files under `functions/`). The browser imports the confidence levels from it; every score is computed server-side.
3. **Extra files:** `public/ui.js` (auto-escaping HTML template, fetch wrapper, localStorage wrapper, SVG charts) and `public/_headers` (CSP `default-src 'self'`, nosniff, no-referrer). `test/unit.test.js` holds the non-metric unit tests; `npm test` runs both test files.
4. **`first_session_id` is sent on every later session from the same browser,** not only on the bilingual re-take. The browser keeps its first session id in localStorage (`hs_first`). This is what lets PREREG's exclusion "repeat sessions from the same browser identifier (keep the first)" be applied; bilingual pairs are linked sessions in different languages. See open questions (PRIVACY.md wording).
5. **Seen items** are kept in localStorage (`hs_seen`); later sessions avoid seen two-choice and range items while enough remain. Attention items are never excluded (every session needs both). The re-take carries no class code, so one student is not counted twice on a class dashboard.
6. **Class dashboard counts every completed session with the code,** including attention failures; `n` and all aggregates use that same set. `/api/stats`, `global` and percentiles use passed sessions only.
7. **Attention items look exactly like two-choice items** (answer + confidence) so they blend in; their confidence never enters a metric.
8. **Range input:** low > high is warned once, then swapped; values outside the item's `accept` bounds are warned once, then kept (PREREG excludes them at analysis time). Empty or non-numeric input always blocks. The server rejects only non-finite numbers and low > high; it does not reject fast answers or out-of-bounds ranges.
9. **Honeypot:** the hidden form field is named `hs_extra` (so browser autofill leaves it alone) and is sent to the API as `website`.
10. **Running aggregates (follow-up request, 2026-10-03).** `migrations/0002_aggregates.sql` adds `agg_totals`, `agg_hist`, `agg_bins`, `agg_country`; `functions/_aggregates.js` holds the bins, the histogram percentile and the upserts. A submit is one `env.DB.batch()` (one transaction): read the language's histogram (≤ 28 rows), insert the session, then 4 upserts. Only sessions that passed both attention checks are aggregated. `/api/stats` reads only the aggregate tables (still cached 60 s); `n_countries` = `agg_country` rows except `ZZ`/`XX`/`T1`. No backfill: aggregates start empty, so 0002 must be applied before real traffic (true today; a local dev DB with older sessions should be recreated). Class dashboards still read their own class's sessions; `EXPLAIN QUERY PLAN` (checked in smoke.sh) shows `SEARCH sessions USING INDEX idx_sessions_class`. The `sessions(lang, passed_attention)` index is no longer used by the API but is kept as the brief asks (one extra index row per insert; useful for analysis queries).

## Definitions the brief left open

- Stored `answers` JSON: `{id, type, choice, conf (50–100), rt_ms, correct}` or `{id, type, low, high, rt_ms, hit}`; `correct`/`hit` are server-computed. `/api/stats` aggregates bins from it with `json_each`.
- Score columns are rounded to 6 decimals, so equal scores compare equal in the percentile query.
- `n_answers` = scored answers in passed sessions (18 per session; attention items excluded).
- `percentile.overconf` = mid-rank from `agg_hist` among same-language passed sessions, current session excluded: share of sessions in lower bins plus half of your own bin. Overconfidence bins are 0.05 wide (`round(overconf × 20)`, clamped to ±10, i.e. ±0.5), so sessions within the same 0.05 band count as ties; hit-rate bins are exact (`round(int_hit × 6)`). Copy: "more overconfident than p%" / "caught the answer more often than p%". `null` below 30 sessions.
- `n_countries` excludes Cloudflare's non-country codes `ZZ`, `XX`, `T1`.
- `overconf_hist`: 15 buckets of 10 percentage points from −50 to +100 (lower bound inclusive, values outside clamped to the end buckets).
- Results headline: three cases (more / less / equal, after rounding to whole points).

## Third-party code

`public/vendor/qrcode.js` = qrcode-generator 2.0.4 by Kazuhiko Arase, MIT license (copyright and license notice kept in the file header), from npm `dist/qrcode.mjs`; source https://github.com/kazuhikoarase/qrcode-generator. Change: removed the unused HTML/SVG/ASCII/canvas renderer methods (the acceptance grep's `gtag` pattern matched `createSvgTag`). Encoder untouched; the share card draws modules itself.

## Known limits (not fixed, by design or out of scope)

- **D1 quotas.** Reads are bounded per request since change 10 (about 40 rows per submit, a few hundred per uncached stats call). Writes are now the binding limit: about 8–13 rows per finished test (session + 2 index entries + up to 10 aggregate rows), so the free tier's 100K rows written per day covers roughly 7,500 finished tests a day; past that D1 refuses writes until midnight UTC. Upgrade to Workers Paid before a launch post that could exceed it.
- smoke.sh reads fresh stats by asking through `localhost` instead of `127.0.0.1`: the Cache API key is the full URL, so another host name skips the 60 s cache.
- **Cache API** is verified locally only. If it turns out to be a no-op on `*.pages.dev`, `/api/stats` is computed on every call (a few hundred rows read each, same results); a custom domain avoids the question.
- **No rate limiting in code** (Pages Functions have none built in). Add a Cloudflare WAF rate-limiting rule for `/api/*` after deploy.
- SPA routing relies on Pages' default (no `404.html` → `index.html` for `/stats`, `/class`, `/class/d/…`); verified in `wrangler pages dev`.
- Browser checks were done in Chromium at 375 px (landing, items, validation, demographics, results, en/zh share cards in both sizes, class pages, dashboard, stats). Not checked on real iOS Safari or the WeChat in-app browser.
- `compatibility_date = 2026-09-01`; wrangler 4.147.0 accepted it without warnings.
