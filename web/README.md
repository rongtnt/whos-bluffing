# HowSure web

English only. A free daily game (five 90%-range questions, the same for everyone each UTC day) and a 5-minute full assessment (12 two-choice questions with a confidence rating, 6 numeric 90% ranges, 2 attention checks). Static frontend (vanilla ES modules, no bundler) on Cloudflare Pages, API in Pages Functions, data in D1. No accounts, no cookies, no third-party scripts or fonts, no IP or user-agent storage.

## Page map

Every page is a static HTML file in `public/` with the same head (title, description, canonical, Open Graph and Twitter tags pointing at `/og.png`, icons, theme colours), header and footer; `test/site.test.js` fails if a page drifts from `scripts/page.html` or is missing from `sitemap.xml`. Pages share `styles.css` (design tokens, light and dark) and `site.js` (theme toggle stored in localStorage, mobile menu, Slack link, command search). The app pages also load `app.js`.

| Path | File | What |
|---|---|---|
| `/` | `index.html` | Hero with "Play today's game" (starts the daily game in place) and "Add to Slack"; social-proof numbers from 100 monthly players, else one line; then the game or today's result, How it works, Three ways to play, Open research, FAQ |
| `/test` | `test.html` | Full assessment (`/test?c=CODE` joins a class) |
| `/stats` | `stats.html` | MAU / DAU / communities (from the daily KPI job, with the PREREG definitions), Anki contributors as a separate line, today's daily histogram, full-assessment curve |
| `/class`, `/class/d/<secret>` | `class.html` | Classroom mode: create a code; the teacher's live dashboard (aggregates only, from 5 students). `_redirects` serves the dashboard URLs from `class.html` |
| `/slack` | `slack.html` | Slack app: Add to Slack, illustration of the post and the form, searchable commands, what we store, troubleshooting, FAQ |
| `/teachers` | `teachers.html` | Classroom mode pitch, 3 steps, privacy points, link to `/class` |
| `/research` | `research.html` | The question, H1–H3 in plain words, the MAU and community definitions quoted from PREREG, open data, pre-registration, how to cite |
| `/support` | `support.html` | GitHub issues, FAQ links, what to put in a bug report |
| `/privacy`, `/terms`, `/docs/api` | generated | Rendered from `PRIVACY.md`, `TERMS.md` and `docs/api-daily.md` by `scripts/sync-docs.js` (git-ignored, see below) |
| `/tests/overconfidence-test`, `/tests/estimation-test`, `/tests/calibration-test` | `tests/*.html` | Static explainer pages |
| anything else | `404.html` | Branded "Page not found" with status 404 (with a `404.html`, Pages no longer falls back to `index.html`) |

**Add to Slack:** every Add to Slack button on `/slack` takes its address from the constant `SLACK_INSTALL_URL` at the top of `public/site.js`. It defaults to `https://YOUR-WORKER-HOST/slack/oauth/start`; set it to the Slack Worker's install URL (`slack/README.md`, step 8) before launch. The home page's "Add to Slack" goes to `/slack`.

**Docs pages:** `npm run sync-items` (also run by `npm run dev`, `npm test` and `test/smoke.sh`) runs `scripts/sync-docs.js`, which converts `PRIVACY.md`, `TERMS.md` and `docs/api-daily.md` (repo root) into `public/privacy.html`, `public/terms.html` and `public/docs/api.html` inside the page template `scripts/page.html`. Edit the Markdown, never the generated HTML; run `npm run sync-items` before a deploy.

**Images and screenshots** (`design/`, needs Google Chrome; `CHROME=/path/to/chromium` picks another build):
- `node design/render.js assets` renders `public/og.png` (1200×630, from `design/og.html`), `public/favicon-32.png` and `public/apple-touch-icon.png` (180, from `design/icon.html`, which shows `public/favicon.svg`). Run it after changing the templates, the logo or the tokens, and commit the PNGs.
- `node design/render.js screens` writes `design/screens/<page>-<width>-<theme>.png` for `/`, `/slack`, `/research` and the results screen at 375, 768 and 1280 px, light and dark, against a running `npm run dev` (it plays today's game through the API for four local players first).
- `node design/render.js checks` reports layout shift and horizontal overflow at 375 and 1280 px on every page, a Tab walk over `/` and `/slack` (every control reached, each with a focus ring) and the theme toggle's label and persistence.
- `node design/contrast.js` checks every text/background pair of the tokens in `styles.css`, light and dark.

API (JSON): the daily game follows `docs/api-daily.md` exactly — `GET /api/daily`, `POST /api/daily/answer`, `POST /api/daily/complete`, `GET /api/daily/stats` (cached 60 s), `POST /api/flag`, `GET /api/kpi` — plus `POST /api/kpi/run` (needs the `x-kpi-key` header), `POST /api/submit`, `GET /api/stats`, `POST /api/class`, `GET /api/class/:code`, `GET /api/class/d/:secret[.csv]`.

Anki add-on v0.2 (opt-in sharing; `migrations/0004_anki.sql`, `functions/_anki.js`): `POST /api/anki/submit` `{install_id, addon_version, consent_version, rows: [≤ 2,000]}` → `{accepted, duplicates, total_rows_for_install}` (idempotent on `install_id` + `row_id`; 410 once the install deleted its data), `POST /api/anki/delete` `{install_id}` → `{deleted_rows}`, `GET /api/anki/stats` → `{installs_30d, rows_total}` (cached 60 s). `GET /api/kpi` and the KPI run also return `anki_contributors_30d`, which is not part of MAU.

## Run locally (Node 22, Python 3.9+)

```bash
cd web && npm install        # wrangler is the only (dev) dependency
npm run migrate:local        # creates the local D1 tables (0001-0004)
npm run dev                  # syncs items, pool and schedule, then serves http://127.0.0.1:8788
```

Tests: `npm test` (metric vectors, unit tests on a real SQLite database through `node:sqlite`, the static-site checks in `test/site.test.js`, and the Python item-pipeline tests on a saved SPARQL fixture; no network) and `bash test/smoke.sh` (fresh local D1, real `wrangler pages dev`, curls every page and endpoint, plays a full day for three players, flags an item until it retires, runs the KPI job).

## Deploy (you run these; needs a free Cloudflare account)

```bash
cd web
npx wrangler login
npx wrangler d1 create howsure                          # paste the printed database_id into wrangler.toml
npx wrangler d1 migrations apply howsure --remote
npm run sync-items && npx wrangler pages deploy --project-name howsure
npx wrangler pages secret put KPI_KEY --project-name howsure   # any long random string; protects POST /api/kpi/run
```

`pages deploy` uploads `public/` and bundles `functions/` as they are on disk, so always run `npm run sync-items` first: it writes the git-ignored copies `public/items.json`, `public/pool.json` (prompts only), `functions/_items.json`, `functions/_pool.json` and `functions/_schedule.json`. The schedule is bundled into the API, so **any change to `daily/schedule.json` goes live only after `npm run sync-items` and a deploy**.

### Daily KPI job (cron)

Pages Functions cannot run on a schedule. `kpi-worker/` is a tiny Worker whose cron calls `POST /api/kpi/run?as_of=<yesterday>` once a day with the key; the job scans `plays`, `players` and `sessions` once and writes one row to `kpi`, which is all `/stats` and `GET /api/kpi` read. Its `kpi-worker/wrangler.toml`:

```toml
name = "howsure-kpi"
main = "src/index.js"
compatibility_date = "2026-09-01"

[vars]
RUN_URL = "https://howsure.pages.dev/api/kpi/run" # replace with the deployed site's address

[triggers]
crons = ["10 0 * * *"] # 00:10 UTC every day
```

```bash
cd web/kpi-worker
npx wrangler secret put KPI_KEY      # the same value as the Pages project's KPI_KEY
npx wrangler deploy
```

Run it by hand (or from any external daily ping instead of the Worker): `curl -X POST -H "x-kpi-key: $KPI_KEY" "https://<site>/api/kpi/run?as_of=2026-10-20"` (`as_of` defaults to today, UTC). A missing or wrong key gets 401; an unset `KPI_KEY` refuses every call.

## The nightly review (two minutes)

```bash
cd web
npm run tomorrow             # tomorrow's 5 items (UTC) with answers and source links; `npm run tomorrow -- 2026-10-25` for any day
```

Check each answer against its source. To swap an item, replace its id in `daily/schedule.json` (one line per day) with another `w####` id from `items/pool.json` — same category, not used on a day within 180 days — then `npm run sync-items` (it validates the file) and deploy. Items players flagged three times are retired automatically and left out of the game; list them with
`npx wrangler d1 execute howsure --remote --command "SELECT item_id, retired_at FROM items_runtime WHERE retired_at IS NOT NULL"` and swap them out of future days.

Keep the schedule filled: `npm run schedule` appends days up to 120 ahead and never changes a day that is already in the file (past days were played; future days may have your swaps). Rules for new days: 5 different categories (least recently used first), no item that appears on another day within 180 days, retired items skipped. Once players have answered items, export their difficulty and the scheduler mixes easy, medium and hard items:
`npx wrangler d1 execute howsure --remote --json --command "SELECT item_id, n_answers, n_hits, retired_at FROM items_runtime" > ../daily/runtime.json`.

## Questions

- Full assessment: `items/items.json` is the only place to edit its questions (the `zh` fields stay there but are never shipped).
- Daily pool: `items/pool.json`, generated from Wikidata by `python3 analysis/items_pipeline/wikidata_pool.py` (from the repo root; `--raw-dir DIR` caches the raw SPARQL responses). Re-running keeps every existing id and carries over scheduled items; it rewrites `items/pool.REVIEW.md` (counts per category, 30 random samples to spot-check). If Wikidata is unreachable the script exits with an error and leaves the pool alone.

## Quotas (D1 free tier: 5M rows read, 100K rows written per day)

No request reads an unbounded number of rows: the daily game reads at most a day's 5 items, one player's play and the day's `daily_agg` rows (one per surface); `/api/daily/stats` is cached 60 s; only the KPI job scans tables, once a day. Writes are the limit: a completed daily play writes roughly 25 rows (5 answers and 5 item counters, the play, the player and the day's aggregate, each with its primary-key index), so the free tier covers about 4,000 daily plays a day, or about 7,500 full assessments (8-13 rows each). Upgrade to Workers Paid before a launch post that could exceed that. Anki uploads read about two rows and write about one row per rating (`anki_rows` is `WITHOUT ROWID`, so a 500-rating request writes about 500 rows), and a delete writes one row per deleted rating, so the free tier also caps Anki sharing at roughly 100,000 ratings a day.

## Manual checklist (after each deploy)

1. Phone, 375 px wide: `/`, `/slack`, `/teachers`, `/research`, `/test`, `/stats`, `/class`, one `/tests/...` page; no sideways scrolling anywhere; the menu button opens the links; the theme toggle switches and stays switched on the next page.
2. `/`: "Play today's game" starts the five questions; each "Lock in" shows the answer, its source link, your range and one-line note.
3. Reload halfway through: the hero button reads "Continue (3 of 5 answered)" and resumes; after the end, `/` shows your result below the hero (the button reads "See your result").
4. Result: grid, today's average and histogram, streak, 30-day hit rate; "Copy result" pastes `HowSure #N 🟩🟥… k/5 at 90%`, the average and the link.
5. "Something wrong with this question?" sends a report (thanks message).
6. `/test`: 20 items; a range with low above high is warned once, then swapped; results, chart and share card.
7. `/class`: create a code; the student link opens `/test?c=CODE`; the dashboard waits for 5 students.
8. `/stats` shows the MAU definition; after the cron's first run it shows MAU, DAU and communities.
9. `npm run tomorrow` prints tomorrow's items; the Worker's cron log shows a 200 from the run endpoint.
10. `npx wrangler d1 execute howsure --remote --command "SELECT * FROM players LIMIT 3"`: anonymous ids only, no IP address or user agent.

Deviations from the brief and known limits: `NOTES.md`.
