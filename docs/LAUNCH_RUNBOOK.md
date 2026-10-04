# Launch runbook

The owner's click-by-click list for launch morning is `USER_TODO.md` (one list, dependency-ordered). This file keeps
the operator side and the calendar.

## Done before launch (2026-10-04, UTC night)
- Site live at https://whosbluffing.com (www and bots hosts), D1, KPI cron (10 0 * * *), rate limit 20 req / 10 s per IP on `/api/`.
- Pre-registration frozen: `prereg/PREREG.md` v1, tag `prereg-v1`. Plays before the freeze are test plays.
- Slack Worker https://whosbluffing-slack.rongaijun41.workers.dev and Discord Worker https://whosbluffing-discord.rongaijun41.workers.dev deployed with D1, `BOT_KEY` and `SALT`; the owner adds the app-registration secrets (USER_TODO C and D).
- Fact-checked item pool and rebuilt ranked rounds; `scripts/check.sh` green; new brand mark in `brand/`.

## Launch day (Monday 2026-10-05, posts at 09:00 US Eastern)
- Show HN, r/InternetIsBeautiful, r/samplesize, X thread, r/Discord_Bots, LessWrong / EA Forum, newsletter emails (drafts in `posts/`). Reply to every comment for the first 6 hours.
- Watch `/stats`, Cloudflare analytics (errors, 429s), item flags, GitHub issues, bot Worker logs (`npx wrangler tail` in `slack/` and `discord/`).
- If D1 writes approach the free-tier cap, switch to Workers Paid the same day.

## Every night
- `cd web && npm run tomorrow`: read tomorrow's ten items and sources; swap anything doubtful in `daily/schedule.json`; commit.
- `daily/LAUNCH_REVIEW.md` lists the first two weeks for a faster pass.

## Calendar
- Tue 2026-10-06: r/Professors and three instructor emails.
- Days 1–30: `docs/GROWTH_PLAYBOOK.md` (bot listings, vote asks, SEO question pages, milestone posts).
- Nov: Product Hunt (`posts/producthunt.md`) featuring the Slack and Discord apps; Slack App Directory submission (`posts/slack-directory.md`).
- Mid-November gate: if MAU ≥ 20K, build the Chrome new-tab extension; otherwise keep pushing the existing surfaces.
- Dec / Jan: first results post when passed sessions ≥ 5,000; dataset v1 with the data card; Jan 25 freeze numbers for applications.
