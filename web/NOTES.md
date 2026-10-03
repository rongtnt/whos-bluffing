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

## Definitions the brief left open

- Stored `answers` JSON: `{id, type, choice, conf (50–100), rt_ms, correct}` or `{id, type, low, high, rt_ms, hit}`; `correct`/`hit` are server-computed. `/api/stats` aggregates bins from it with `json_each`.
- Score columns are rounded to 6 decimals, so equal scores compare equal in the percentile query.
- `n_answers` = scored answers in passed sessions (18 per session; attention items excluded).
- `percentile.overconf` = mid-rank among same-language passed sessions, current session excluded: % with lower overconfidence + half the ties. Copy: "more overconfident than p%". `percentile.int_hit` the same for hit rate: "caught the answer more often than p%". `null` below 30 sessions.
- `n_countries` excludes Cloudflare's non-country codes `ZZ`, `XX`, `T1`.
- `overconf_hist`: 15 buckets of 10 percentage points from −50 to +100 (lower bound inclusive, values outside clamped to the end buckets).
- Results headline: three cases (more / less / equal, after rounding to whole points).

## Third-party code

`public/vendor/qrcode.js` = qrcode-generator 2.0.4 by Kazuhiko Arase, MIT license (copyright and license notice kept in the file header), from npm `dist/qrcode.mjs`; source https://github.com/kazuhikoarase/qrcode-generator. Change: removed the unused HTML/SVG/ASCII/canvas renderer methods (the acceptance grep's `gtag` pattern matched `createSvgTag`). Encoder untouched; the share card draws modules itself.

## Known limits (not fixed, by design or out of scope)

- **D1 reads.** The percentile query reads every same-language passed row on each submit; `/api/stats` reads all passed rows (with `json_each`) at most once a minute per data centre. Free tier = 5 million rows read per day; at about 1,000 submits a day with 5,000+ stored sessions the free tier runs out and D1 errors until midnight UTC. Upgrade path in the code comment: percentile from a cached histogram. Simplest fix: Workers Paid ($5/month) before launch posts.
- **Cache API** is verified locally only. If it turns out to be a no-op on `*.pages.dev`, `/api/stats` is computed on every call (more reads, same results); a custom domain avoids the question.
- **No rate limiting in code** (Pages Functions have none built in). Add a Cloudflare WAF rate-limiting rule for `/api/*` after deploy.
- SPA routing relies on Pages' default (no `404.html` → `index.html` for `/stats`, `/class`, `/class/d/…`); verified in `wrangler pages dev`.
- Browser checks were done in Chromium at 375 px (landing, items, validation, demographics, results, en/zh share cards in both sizes, class pages, dashboard, stats). Not checked on real iOS Safari or the WeChat in-app browser.
- `compatibility_date = 2026-09-01`; wrangler 4.147.0 accepted it without warnings.
