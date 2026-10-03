# Launch runbook (soft launch Oct 17; posts Oct 20)

## T-7 (by Oct 10)
- [ ] Repo pushed (private). `scripts/check.sh` green on your machine.
- [ ] Cloudflare: `wrangler login`; D1 created; `migrations apply --remote`; `npm run sync-items`; Pages deployed; KPI_KEY set on Pages and on `web/kpi-worker`; kpi-worker deployed; rate-limit rule on `/api/*`.
- [ ] Domain bound (howsure.me) or replace the hard-coded domain in `web/public/sitemap.xml`, `robots.txt`, share text and `kpi-worker` RUN_URL.
- [ ] Slack app created from `slack/manifest.yaml`; secrets set; worker deployed; installed in a test workspace; one full play; leaderboard renders.
- [ ] Items: `items/REVIEW.md` source pass done; fact-check report (`analysis/factcheck-*.md`) actioned; `npm run tomorrow` for each of Oct 17–31 looked at once.

## T-1 (Oct 16)
- [ ] Freeze pre-registration: commit `prereg/PREREG.md` with "FROZEN 2026-10-16" in the status line; tag `prereg-v1`.
- [ ] Play tomorrow's game on the live site from a phone; check share card, copy, QR, `/stats`, `/class`, `/test`.
- [ ] Confirm the KPI job ran (`/api/kpi` has `as_of` = today).

## Launch day (Oct 20, posts in the morning US Eastern)
- [ ] 09:00 Show HN (`posts/show-hn.md`), then r/InternetIsBeautiful and r/samplesize (`posts/reddit-samplesize.md`).
- [ ] 10:00 LessWrong + EA Forum (`posts/lesswrong.md`); emails to newsletters (`posts/newsletter-email.md`).
- [ ] 12:00 r/Professors (`posts/reddit-professors.md`); send `posts/instructor-pitch.txt` to instructors you know.
- [ ] Watch: `/stats` (players, countries), Cloudflare analytics (errors, rate limits), item flags, GitHub issues. Reply to every HN/Reddit comment for the first 6 hours.
- [ ] If D1 writes approach the free-tier cap (~7,500 finished tests/day), switch to Workers Paid the same day.

## Every night from Oct 17
- [ ] `cd web && npm run tomorrow` — read the five items and sources; swap anything doubtful in `daily/schedule.json`; commit.

## Nov 18
- [ ] Product Hunt (`posts/producthunt.md`) featuring the Slack app; r/slack, r/startups the same day. Submit to the Slack App Directory (`posts/slack-directory.md`).

## Mid-November gate
- [ ] If MAU ≥ 20K: build the Chrome new-tab extension (public user count). Otherwise keep pushing the two existing surfaces.

## Dec / Jan
- [ ] First results post when passed sessions ≥ 5,000; dataset v1 with the data card.
- [ ] Jan 25: freeze numbers for applications (MAU, communities, plays, dataset downloads).
