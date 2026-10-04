# HowSure v4 — scale plan (English only, no Discord)

2026-10-03. Target set by the user: the kind of line a Stanford admit wrote — "Scaled to 500,000 MAU across 1,500,000 communities — pretty cool infra, ask me about it." Our product is not Discord; the mechanism that produced that number was **install-once distribution** (one server add = many users) plus a **simple social loop**. v4 rebuilds HowSure around those two mechanisms.

One honesty line: 500K MAU is a Wordle-class outcome; this plan maximizes the odds, and the January description states whatever number is real.

## What changes from v3

| | v3 | v4 |
|---|---|---|
| Core | one-shot 20-item test | **daily game**: 5 range questions a day, same for everyone, share grid, streaks; the 20-item test stays as "full assessment" |
| Primary channel | social posts | **Slack app** (install once, whole workspace plays daily; MAU counts answerers) + the daily web game |
| Phase 2 (only if numbers exist by mid-Nov) | — | Chrome new-tab extension (public user count), Telegram bot (same backend) |
| Language | en + zh | **English only** (zh removed, not hidden) |
| Research H3 | foreign-language effect | **practice effect**: does daily feedback improve calibration over days (with survivorship checks) |
| Items | 62 hand-checked | 62 + a Wikidata-generated pool of numeric items; the user reviews tomorrow's 5 every night |
| Headline metric | participants | **MAU** (defined in PREREG) + communities (workspaces + classrooms) |

## Precedents (verified 10/3)
- Wordle: 90 players (Nov 1 2021) → 300K (Jan 2 2022) → 2M+ a week later; the emoji share grid, added Dec 2021, drove it (1.2M results tweeted Jan 1–13).
- Human Benchmark: 2.63M visits/month, 46% Google organic, 39% direct — a suite of short self-tests lives on search.
- Polly (Slack/Teams polls & trivia): 1M+ monthly users, 200K+ companies. Donut: 20K companies. Install-once workplace apps reach MAU numbers a solo web page does not.
- Prior art to credit, not to copy-claim: Quantified Intuitions' Estimation Game (monthly, 10 Fermi questions, 90% CIs, teams, global leaderboard) and Calibration Training; the share-grid pattern is Wordle's. Our differences: daily, 30 seconds, share grid, Slack and classroom distribution, open data, pre-registered practice-effect study. No "first" claims.

## Product

**Daily game (web).** UTC day. 5 interval items, immediate feedback per item (truth, source, inside/outside your range). Score 0–5 hits. Share: `HowSure #12 🟩🟩🟥🟩🟩 4/5 at 90% · today's average 2.8/5 · howsure.me` copied in one tap, plus the PNG card. Streak and personal calibration curve kept locally and (anonymous id) on the server. Archive of past days. Country leaderboard. SEO landing pages for "overconfidence test", "estimation test", "calibration test" that lead to the full assessment.

**Slack app.** "Add to Slack" link live from day one (App Directory listing later). A daily post in a chosen channel at a set UTC hour with a Play button → modal with 5 low/high pairs → private result + a channel leaderboard (daily and 30-day). `/howsure` plays on demand. Workspace = community. Participants counted when they answer.

**Classroom mode** stays (web). Communities = Slack workspaces + classrooms.

**Items.** Pool generated from Wikidata (areas, heights, lengths, distances, years, counts) with a source link on every item, sanity bounds, dedupe, volatility filter (no yearly-changing values unless year-stamped), difficulty estimated online from play. Players can flag an item; a flagged item retires and that day's scores are recomputed. **The user reviews tomorrow's 5 items each night** (`npm run tomorrow` prints them with sources; swapping an item is a one-line edit to `daily/schedule.json`). Ownership becomes a two-minute daily habit.

**Metrics (definitions in PREREG).** MAU = anonymous ids with ≥1 completed play in the trailing 30 days, summed across web and Slack without cross-surface deduplication (stated). DAU likewise. Communities = workspaces with ≥1 play in 30 days + classrooms with ≥5 finished tests. Computed once a day by a scheduled job into a `kpi` table; the live stats page reads only that table.

## Research
- H1 overconfidence replicates at scale (interval hit rate ≪ 0.90; hard–easy at item level with large N per item).
- H2 format and difficulty effects (full test 2AFC vs intervals; item-level IRT).
- H3 practice effect: within-person change in hit rate and interval width over plays 1–14 for players with ≥7 plays; survivorship check = day-1 calibration of players who later churn vs persist; a null is a result.
- Open data releases with the data card; `PREREG.md` frozen before the public launch.

## Infra ("ask me about it")
Cloudflare Pages + Functions + D1 (+ one Worker for Slack, one cron Worker for KPIs). Bounded-read aggregates (v3), per-day KPI job, Wikidata item pipeline with online difficulty, multi-surface daily API, honeypot + attention + rate rules, all on roughly $5/month at six-figure MAU.

## Funnel and calendar (numbers freeze Jan 25)
| When | What | Owner |
|---|---|---|
| Oct 17 | daily game + Slack app live; PREREG frozen | Opus builds, Fable gates, user reviews items |
| Oct 20 | Show HN; r/InternetIsBeautiful, r/samplesize; LessWrong + EA Forum post; email to ACX/forecasting newsletters; r/Professors (classroom) | user posts (drafts in posts/) |
| Oct–Nov | Slack: Product Hunt launch (~Nov 18), r/slack, team-ritual newsletters; App Directory submission | user |
| mid-Nov gate | if MAU ≥ 20K: build Chrome new-tab (public user count) | Fable decides |
| Dec | first data post (results are themselves shareable); dataset v1 | Fable + user |
| Jan 25 | freeze: MAU, communities, plays, dataset downloads | — |

Planning ranges at Jan 25: floor 10K MAU / 50 workspaces; median 60–150K / 500 workspaces; optimistic 500K+ (requires a share-loop breakout).

## Decisions taken (user can reverse)
English only; Slack primary; Chrome and Telegram phase 2; Anki add-on stays at v0.1 as a shipped side artifact; name HowSure.

## Phase 2 additions (decided 2026-10-04)
- **iOS app** once the owner has an Apple Developer account: SwiftUI client on the rounds API, native share sheet, a home-screen widget with the day's question, opt-in notification at the daily reveal, Game Center leaderboard for the ranked round. App Store search becomes the fourth install surface.
- **Licence**: all rights reserved with a verification grant (LICENSE); datasets CC BY-NC 4.0. Site and posts say "source published", never "open source".

