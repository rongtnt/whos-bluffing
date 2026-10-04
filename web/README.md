# Who's Bluffing? web

English only. A free game of rounds (ten either-or comparison questions with a confidence each: one ranked round a day, the same for everyone, then unlimited quick rounds, challenge links, and one question a day for Slack and Discord) and a 5-minute full assessment (12 two-choice questions with a confidence rating, 6 numeric 90% ranges, 2 attention checks). Static frontend (vanilla ES modules, no bundler) on Cloudflare Pages, API in Pages Functions, data in D1. No accounts, no cookies, no third-party scripts or fonts, no IP or user-agent storage.

## Page map

Every page is a static HTML file in `public/` with the same head (title, description, canonical, Open Graph and Twitter tags pointing at `/og.png`, icons, theme colours), header (Play · Discord · Slack · Commands · Research · Support, the speaker and theme toggles) and footer (Product, Resources, Legal, social icons, licence line); `test/site.test.js` fails if a page drifts from `scripts/page.html` or is missing from `sitemap.xml`. Pages share `styles.css` (design tokens, light and dark, motion) and `site.js` (theme and sound settings, class mode, mobile menu, install and social links from its constants, tabs, card search, the logo's pop). The app pages also load `app.js`; `/status` loads `status.js`.

| Path | File | What |
|---|---|---|
| `/` | `index.html` | Hero: the mark, pack chips and difficulty for quick rounds (`picker.js`), "Play now" (today's ranked round first, then quick rounds in the picked pack and difficulty; `rounds.js`), "Add to Discord", "Add to Slack", the line "N+ questions, every one with a source" and, from 100 monthly players, the live numbers; then the round or its result, How it works, Three ways to play, Open research, FAQ. `/?pack=…&difficulty=…` preselects a pack |
| `/c/<round>/<token>` | Pages Function `functions/c/[round_id]/[player].js` | Challenge page: the page template with per-link Open Graph tags ("Sam scored 640. Can you beat them?"), `noindex`, its own security headers; plays the same round, then shows the side-by-side. Counts one `challenge_view` per load; an unknown link gets the branded 404 |
| `/test` | `test.html` | Full assessment (`/test?c=CODE` joins a class) |
| `/stats` | `stats.html` | MAU / DAU / communities per surface and platform (from the daily KPI job, with the PREREG definitions), the engagement numbers with one-line definitions, Anki contributors as a separate line, today's ranked-round histogram, full-assessment curve |
| `/class`, `/class/d/<secret>` | `class.html` | Classroom mode: create a code; the teacher's live dashboard (aggregates only, from 5 students). `_redirects` serves the dashboard URLs from `class.html` |
| `/discord` | `discord.html` | Discord app: Add to Discord, illustration of the daily post, the private confidence picker and the reveal, searchable command cards, what we store, "Commands not working?", FAQ |
| `/slack` | `slack.html` | Slack app, the same layout as `/discord` |
| `/commands` | `commands.html` | Tabs Discord · Slack · Web shortcuts: searchable command cards (what it does, options, who can run it) and "Commands not working?" per platform; `#discord`, `#slack`, `#web` open a tab |
| `/teachers` | `teachers.html` | Classroom mode pitch, 3 steps, privacy points, link to `/class` |
| `/research` | `research.html` | The question, why honest confidence scores best (the quadratic rule; Brier 1950, Gneiting and Raftery 2007), H1–H3 in plain words, the MAU and community definitions quoted from PREREG, open data, pre-registration, how to cite |
| `/support` | `support.html` | GitHub issues, FAQ links, what to put in a bug report |
| `/community` | `community.html` | The Discord server ("opening soon" until `COMMUNITY_INVITE_URL` is set): daily reveals, feedback, play with others; GitHub issues; email once `CONTACT_EMAIL` is set |
| `/status` | `status.html` + `status.js` | Live: one timed request to `/api/round/stats`, the latest KPI run (`as_of`) and its numbers; the GitHub Actions link once `ACTIONS_URL` is set |
| `/press` | `press.html` | Boilerplate, logo (SVG mark, PNG wordmark light and dark, 512 px icon), `og.png`, four screenshots, contact |
| `/privacy`, `/terms`, `/changelog`, `/docs/api` | generated | Rendered from `PRIVACY.md`, `TERMS.md`, `CHANGELOG.md` and, for the API, `web/docs/public-api.md` (public reads, CORS, rate limits, attribution, open data) + `docs/api-rounds.md` + `docs/api-daily.md` by `scripts/sync-docs.js` (git-ignored, see below) |
| `/tests/overconfidence-test`, `/tests/estimation-test`, `/tests/calibration-test` | `tests/*.html` | Static explainer pages |
| anything else | `404.html` | Branded "Page not found" with status 404 (with a `404.html`, Pages no longer falls back to `index.html`) |

**Constants at the top of `public/site.js`** (set them before launch; an empty one hides what depends on it): `SLACK_INSTALL_URL` (the Slack Worker's `/slack/oauth/start`, `slack/README.md` step 8) and `DISCORD_INSTALL_URL` (the Discord Worker's `/install`, `discord/README.md` step 8) feed the Add buttons on `/slack` and `/discord` (the home page's buttons go to those pages); `COMMUNITY_INVITE_URL` (the community server's invite: the `/community` button and the footer icon), `CONTACT_EMAIL`, `GITHUB_URL`, `X_URL`, `BLUESKY_URL` (footer icons) and `ACTIONS_URL` (the `/status` link to the test runs, once the repository is public).

**Docs pages:** `npm run sync-items` (also run by `npm run dev`, `npm test` and `test/smoke.sh`) runs `scripts/sync-docs.js`, which converts `PRIVACY.md`, `TERMS.md`, `CHANGELOG.md` and the API docs into `public/privacy.html`, `public/terms.html`, `public/changelog.html` and `public/docs/api.html` inside the page template `scripts/page.html`. Edit the Markdown, never the generated HTML; run `npm run sync-items` before a deploy.

**Generated parts of committed pages:** the same sync runs `scripts/sync-pages.js`, which rewrites what sits between comment markers: in `index.html` the question count (`<!-- questions -->`: the pairs any round can serve, rounded down to the thousand) and the pack chips (`<!-- packs -->`: a pack shows when at least one difficulty can fill it, with the difficulties in `data-difficulties`); in `commands.html`, `discord.html` and `slack.html` the command cards and the "Commands not working?" answers from `public/commands.json` (the one source; `test/parity.test.js` checks its names against `discord/src/commands.js` and `slack/src/game.js`). It also copies four screenshots from `design/screens` to `public/press/screen-*.png` (git-ignored) and writes their sizes into `press.html`. A changed `items/pairs.json` can therefore change `index.html`: commit both.

**Images and screenshots** (`design/`, needs Google Chrome; `CHROME=/path/to/chromium` picks another build):
- The brand masters live in `brand/` (repo root): `public/favicon.svg` is a copy of `brand/icon.svg`, `public/press/logo.svg` and `logo-white.svg` of `brand/mark.svg` and `mark-white.svg`, `public/press/icon-512.png` and `icon-192.png` of `brand/png/`; the inline mark in every header and footer is `brand/mark-inline.svg`.
- `node design/render.js assets` renders `public/og.png` (1200×630, from `design/og.html`), `public/favicon-32.png` and `public/apple-touch-icon.png` (180; from `design/icon.html`, which shows `public/favicon.svg`), and the press wordmarks `public/press/logo.png` and `logo-dark.png` (1280×320, from `design/logo.html`). Run it after changing the templates, the logo or the tokens, and commit the PNGs.
- `node design/render.js screens` writes `design/screens/<page>-<width>-<theme>.png` for `/`, `/slack` and `/research` at 375, 768 and 1280 px and `/discord` and `/commands` at 375 and 1280 px, light and dark, plus `home-hero-1280-light.png` and `discord-hero-1280-light.png` (one screen, for the press kit), against a running `npm run dev`.
- `node design/render.js rounds` writes `design/screens/rounds-{item,reveal-right,reveal-wrong,end,challenge}-<width>-<theme>.png` at 375 and 1280 px with motion on: four API players finish today's ranked round (for the leaderboard), then the page plays it by clicks (the first answer right at 100%, the second wrong at 100%), and a challenge link from a fifth player is opened. Apply the migrations to the dev database first (`npm run migrate:local`).
- `node design/render.js results` writes `design/screens/results-<width>-<theme>.png` (375, 768, 1280 px): the full assessment at `/test` answered through the page, then its results page, whole.
- `node design/render.js demo` writes the press clips against a running `npm run dev`, with ffmpeg on the PATH (or `FFMPEG=`): `public/press/demo-vertical.mp4` (1080×1920) and `demo.mp4` (1080×1080), the same 20 s edit with sound, `demo.gif` (the square cut's opening 12 s, 640 px, silent), the posters `demo-poster.png` (1200×675) and `demo-vertical-poster.png` (the hook's closing frame), and `design/screens/demo-vertical-frames.png` (six frames, for review). Today's ranked round is played in the page on a stand-in clock (performance.now, frame callbacks, timers and every animation move only between screenshots), so each 1/30 s frame is exact; `design/demo.html` then composes each frame: the hook word by word, the game in a phone over navy with tap rings and up to three captions, the end card, every cut a 0.3 s dissolve. The sound is rendered in `design/soundtrack.js` (the game's own tick, wrong-answer and fanfare sounds from `public/sound.js`, a stamp thud, a synthesised 100 BPM bed) and mixed to −16 LUFS; `--music path` puts another track under the effects (`design/MEDIA_NOTES.md` has a prompt for one). `node design/render.js demo BASE vertical|square` makes one cut. Each run plays the round as fresh players (four by API, for the rank tile). Commit the outputs and update the sizes listed on `/press`.
- `node design/render.js checks` reports layout shift and horizontal overflow at 375 and 1280 px on every page, a Tab walk over `/`, `/slack`, `/discord` and `/commands` (every control reached, each with a focus ring) and the theme toggle's label and persistence.
- `node design/contrast.js` checks every text/background pair of the tokens in `styles.css`, light and dark.

API (JSON). **Rounds** follow `docs/api-rounds.md` (`functions/_rounds.js`, `migrations/0005_rounds.sql`): `GET /api/round?mode=ranked|quick&seen=…&difficulty=easy|normal|brutal&pack=<pack|all>` (packs and their categories: `public/packs.js`; a pack other than `all` is offered at a difficulty only when it has at least 200 pairs that can take a main slot there and enough at every level the mix uses, else 400 `not enough questions in this pack at this difficulty`; unknown pack 400; the body echoes `pack`; ranked rounds and challenge links ignore it), `POST /api/round/answer`, `POST /api/round/complete`, `GET /api/round/:round_id/compare?me=&them=`, `GET /api/round/stats?date=` (cached 60 s), `POST /api/event`, `GET /api/round/daily-question?date=`, `GET /api/round/reveal?date=&community=`, `POST /api/flag` with a pair id. Round ids: `rk-<date>` (ranked, from `daily/rounds.json`), `dq-<date>` (the Slack/Discord question), 12 characters `A-Z2-9` (quick, stored in `rounds`). Status codes: 400 invalid body, 403 (a pair flag from someone who did not answer it; the reveal of a question that still takes answers, today's or yesterday's, without the bot header), 404 unknown round or item, 409 `{"error":"locked"}` (a daily question older than yesterday). This build's additions (`GET /api/round?round_id=`, the echoed `choice`/`conf`, complete's `challenge` and `today`, the absolute `challenge_url`, the stats bins, pair flags with `round_id` and the retire cascade, points settled at the reveal or by the KPI run) are written into the contract's "Additions" section. **Bot header:** the Slack and Discord workers send `x-bluff-bot: <BOT_KEY>`; the API checks it (constant time, no key = nobody) only where the contract needs it: revealing a question that still takes answers. **429** comes from the Cloudflare rate-limiting rule (Deploy below), not from code. **Public reads:** `GET /api/round/stats` and `GET /api/kpi` answer with `Access-Control-Allow-Origin: *` (aggregates only; the cached stats keep the header); nothing else has CORS. **Bots' host:** `functions/_middleware.js` serves a host starting with `bots.` only for `/api/*` (else 404 `{"error":"not found"}`) and only with `x-bluff-bot` = `BOT_KEY` (else 403 `{"error":"bot host requires key"}`); other hosts pass unchanged.

The retired daily range game keeps `docs/api-daily.md` exactly (`GET /api/daily`, `POST /api/daily/answer`, `POST /api/daily/complete`, `GET /api/daily/stats`, `POST /api/flag` with a pool id) for its data; `/` no longer uses it. Also `GET /api/kpi`, `POST /api/kpi/run` (needs the `x-kpi-key` header), `POST /api/submit`, `GET /api/stats`, `POST /api/class`, `GET /api/class/:code`, `GET /api/class/d/:secret[.csv]`.

Anki add-on v0.2 (opt-in sharing; `migrations/0004_anki.sql`, `functions/_anki.js`): `POST /api/anki/submit` `{install_id, addon_version, consent_version, rows: [≤ 2,000]}` → `{accepted, duplicates, total_rows_for_install}` (idempotent on `install_id` + `row_id`; 410 once the install deleted its data), `POST /api/anki/delete` `{install_id}` → `{deleted_rows}`, `GET /api/anki/stats` → `{installs_30d, rows_total}` (cached 60 s). `GET /api/kpi` and the KPI run also return `anki_contributors_30d`, which is not part of MAU.

## Run locally (Node 22, Python 3.9+)

```bash
cd web && npm install        # wrangler is the only (dev) dependency
npm run migrate:local        # creates the local D1 tables (0001-0005)
npm run dev                  # syncs items, pool and schedule, then serves http://127.0.0.1:8788
```

Tests: `npm test` (metric vectors, unit tests on a real SQLite database through `node:sqlite`, the static-site checks in `test/site.test.js`, packs, host gate, commands and licence checks in `test/parity.test.js`, the result grid, reduced-motion fallback, reaction lines and sound in `test/motion.test.js`, and the Python item-pipeline tests on a saved SPARQL fixture; no network) and `bash test/smoke.sh` (fresh local D1, real `wrangler pages dev`, curls every page and endpoint, plays a full day for three players, flags an item until it retires, runs the KPI job, checks packs, CORS and the bots' host through a `Host` header).

## Deploy (you run these; needs a free Cloudflare account)

```bash
cd web
npx wrangler login
npx wrangler d1 create whosbluffing                          # paste the printed database_id into wrangler.toml
npx wrangler d1 migrations apply whosbluffing --remote
npm run sync-items && npx wrangler pages deploy --project-name whosbluffing
npx wrangler pages secret put KPI_KEY --project-name whosbluffing   # any long random string; protects POST /api/kpi/run
npx wrangler pages secret put BOT_KEY --project-name whosbluffing   # another long random string; the same value goes to the Slack and Discord workers (x-bluff-bot)
```

`pages deploy` uploads `public/` and bundles `functions/` as they are on disk, so always run `npm run sync-items` first: it writes the git-ignored copies `public/items.json`, `public/pool.json` (prompts only), `functions/_items.json`, `functions/_pool.json` (the fields the API reads), `functions/_schedule.json`, `functions/_pairs.json` (compact), `functions/_rounds.json` and `functions/_page.json` (the challenge page's template, from `scripts/page.html`). Pairs and ranked days are bundled into the API, so **any change to `items/pairs.json` or `daily/rounds.json` goes live only after `npm run sync-items` and a deploy**. The bundle is about 1.35 MB (285 KB gzipped).

**Rate limiting and the bots' host** (after the first deploy, in the Cloudflare dashboard). Cloudflare's free rate-limiting rules cannot read request headers, so the Slack and Discord workers call the API through a second hostname instead:

1. Pages project → **Custom domains** → add `bots.whosbluffing.com` next to `whosbluffing.com`.
2. Set the bots' `API_BASE` to `https://bots.whosbluffing.com` (in `slack/wrangler.toml` and `discord/wrangler.toml`) and redeploy them. On that host `functions/_middleware.js` serves only `/api/*` and only with `x-bluff-bot` = `BOT_KEY`.
3. WAF → **Rate limiting rules**: 120 requests per minute per IP, block for a minute (answers 429), with the expression `(http.host eq "whosbluffing.com" or http.host eq "www.whosbluffing.com") and (http.request.uri.path contains "/api/")`, so the bots' host is never limited.

Pages Functions have no rate limiter of their own.

### Daily KPI job (cron)

Pages Functions cannot run on a schedule. `kpi-worker/` is a tiny Worker whose cron calls `POST /api/kpi/run?as_of=<yesterday>` once a day with the key. The run first settles the points of daily-question answers that can no longer change (questions older than yesterday, 35 days back), then scans `round_plays`, `round_answers` (daily questions), `player_days`, `events` and `sessions` once and writes one row to `kpi`: MAU and DAU per surface (web, Slack, Discord, rooms, classroom), communities per platform, and the engagement numbers (rounds per player per day, day-1 and day-7 return, challenge conversion, share rate; trailing 30 days). `/stats` and `GET /api/kpi` read only that row. Its `kpi-worker/wrangler.toml`:

```toml
name = "whosbluffing-kpi"
main = "src/index.js"
compatibility_date = "2026-09-01"

[vars]
RUN_URL = "https://whosbluffing.pages.dev/api/kpi/run" # replace with the deployed site's address

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
npm run tomorrow             # tomorrow's ranked round (UTC): the 10 pairs with both values and both sources, the answer, and the Slack/Discord question; `npm run tomorrow -- 2026-10-25` for any day
```

Check each pair against its two sources. To swap one, replace its id in `daily/rounds.json` (one line per day) with another pair from `items/pairs.json` whose `ref_quality` is `referenced` (PREREG: ranked rounds use only items with a Wikidata reference or a fact-check; `npm run sync-items` refuses anything else), ideally the same difficulty and not used within 180 days, then `npm run sync-items` and deploy. A pair flagged by three players who answered it retires with both of its values; list retired pairs and items with
`npx wrangler d1 execute whosbluffing --remote --command "SELECT pair_id, retired_at FROM pair_runtime WHERE retired_at IS NOT NULL"` (and `items_runtime` for values) and swap them out of future days.

Keep the days filled: `python3 analysis/items_pipeline/pairs.py` (from the repo root) appends days up to 120 ahead and never changes an existing day. Rules for new days: 10 referenced pairs (3 easy, 4 medium, 3 hard by ratio), at most 2 per category, plus one more referenced pair as the daily question; the 22 items are 22 different entities; no pair again within 180 days, no item within 25 days; well-known items first. It also regenerates `items/pairs.json`, keeping every existing pair's id and A/B order. Export `pair_runtime` to `daily/pair_runtime.json` and `items_runtime` to `daily/runtime.json` (`--json`) first and it skips retired pairs and items.

The retired daily range game still has `daily/schedule.json` and `npm run schedule`; nothing on the site plays it.

## Questions

- Full assessment: `items/items.json` is the only place to edit its questions (the `zh` fields stay there but are never shipped).
- Item pool: `items/pool.json`, generated from Wikidata by `python3 analysis/items_pipeline/wikidata_pool.py` (from the repo root; `--raw-dir DIR` caches the raw SPARQL responses). Each item has `name` (as it reads in a comparison), `sitelinks`, `ref_quality` (`referenced` / `imported` = only "imported from Wikimedia project" / `none`) and `fact_checked`. Items with `notes` were corrected or checked by hand and are pinned: kept verbatim, their generated twin (`replaces`) dropped. Re-running keeps every existing id and carries over items used by `daily/schedule.json` or `daily/rounds.json`; it rewrites `items/pool.REVIEW.md`. If Wikidata is unreachable the script exits with an error and leaves the pool alone.
- Familiarity: `python3 analysis/items_pipeline/pageviews.py` (after the pool, before the pairs) gives every item `enwiki` and `views_month` (average monthly English Wikipedia pageviews over the last 3 full months, from the Wikimedia REST API; `--cache DIR` keeps the raw answers). Rerun it monthly; the pool regeneration keeps the last numbers.
- Pairs: `items/pairs.json` (and `items/pairs.REVIEW.md`), generated from the pool by `python3 analysis/items_pipeline/pairs.py` together with `daily/rounds.json` (rules in the script's docstring; `--fresh` ignores the existing pairs and days, for a rebuild before launch). Each pair carries `fame` (the lesser item's `views_month`): ranked rounds and the chat question need both items ≥ 50,000 and referenced; quick rounds take `difficulty=easy|normal|brutal` (docs/api-rounds.md).

## Quotas (D1 free tier: 5M rows read, 100K rows written per day)

No request reads an unbounded number of rows: a round touches its own 10 answers, its pairs' runtime rows, one play, two `player_days` rows and the day's `round_agg` rows (one per surface); `/api/round/stats` is cached 60 s; a reveal reads one community's answers to one question; the only other scan is the recompute after a pair retires (that day's ranked plays, in SQL, once per retired pair); the KPI job scans once a day. Writes are the limit (D1 counts every index entry as a row written): a quick round writes about 50 rows (the round and its key, 10 answers with their 2 index entries, 10 pair counters, the play with its 3 index entries, the player-day and its key), a ranked round about the same plus its `round_agg` row, a daily-question answer about 5. So the free tier's 100,000 rows written per day covers roughly 2,000 rounds a day, or about 7,500 full assessments (8-13 rows each). Upgrade to Workers Paid before a launch post that could exceed that. Anki uploads read about two rows and write about one row per rating (`anki_rows` is `WITHOUT ROWID`, so a 500-rating request writes about 500 rows), and a delete writes one row per deleted rating, so the free tier also caps Anki sharing at roughly 100,000 ratings a day.

## Manual checklist (after each deploy)

1. Phone, 375 px wide: `/`, `/discord`, `/slack`, `/commands`, `/community`, `/status`, `/press`, `/teachers`, `/research`, `/test`, `/stats`, `/class`, one `/tests/...` page; no sideways scrolling anywhere; the menu button opens the links; the theme toggle switches and stays switched on the next page.
2. `/`: "Play" starts today's ranked round at once (badge "Today's ranked round"); pick A or B, then a confidence: both values with units, both source links, the points and the running total.
3. Reload halfway through: the hero button reads "Continue (3 of 10)" and resumes.
4. End screen: score, type card, calibration chart, roast after a confident miss, streak, rank of today's players and the leaderboard; "Play again" starts a quick round with no other tap; "Challenge a friend" asks once for a name, then copies the link; "Share" shows the card (square and wide) and copies the text.
5. Open the challenge link in a private window: the preview title names the challenger; Play runs the same ten; the end shows "You vs …".
6. "Something wrong with this question?" sends a report (thanks message).
7. `/test`: 20 items; a range with low above high is warned once, then swapped; results, chart and share card.
8. `/class`: create a code; the student link opens `/test?c=CODE`; the dashboard waits for 5 students.
9. `/stats` shows the MAU definition; after the cron's first run it shows MAU, DAU, communities and the engagement numbers.
10. `npm run tomorrow` prints tomorrow's ranked round; the Worker's cron log shows a 200 from the run endpoint.
11. `curl -H "x-bluff-bot: $BOT_KEY" "https://<site>/api/round/reveal?community=slack:test"` answers 200; without the header, 403.
12. `npx wrangler d1 execute whosbluffing --remote --command "SELECT * FROM round_plays LIMIT 3"`: anonymous ids and public tokens only, no IP address or user agent.

Deviations from the brief and known limits: `NOTES.md`.
