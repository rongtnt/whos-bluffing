# Rounds API contract (replaces the daily-item loop for the viral game; the full assessment at /test keeps intervals)

All JSON. Dates are UTC `YYYY-MM-DD`. `surface` ∈ {web, slack, discord, room}. `community` is `slack:<team hash>`, `discord:<guild hash>` or `room:<code>`. A **play** = one completed round (10 answered) on web/room/discord, or one in-channel Slack or Discord answer to the daily question.

- `GET /api/round?mode=ranked|quick&seen=<comma ids, ≤300>` → `{round_id, mode, date, items:[{id, prompt, a, b}]}` — 10 comparison pairs. Ranked: the day's fixed 10 from `daily/rounds.json` (same for everyone; only referenced or fact-checked items). Quick: random unseen pairs, difficulty mix by ratio. Never includes values or truth.
- `POST /api/round/answer` body `{round_id, item_id, choice:0|1, conf:50|60|70|80|90|100, rt_ms, anon_id, surface, community?}` → `{correct, truth:{a_value, b_value, unit, a_source, b_source}, points, total}` where `points = 100 − 400·(c − y)²` with c = conf/100, y = 1 if correct. Idempotent per (anon_id, round_id, item_id).
- `POST /api/round/complete` body `{round_id, anon_id, surface, community?, nickname?}` → `{score, accuracy, mean_conf, overconfidence, brier, type, streak, rank_today?, players_today?, challenge_url, share_text, roast?}`. Marks the play. `type` ∈ {Bluffer, Hot-headed, Calibrated, Modest, Hedger} from overconfidence = mean_conf − accuracy (≥ +15, +5..+15, −5..+5, −15..−5, ≤ −15 in percentage points).
- `GET /c/:round_id/:player` (Pages Function, HTML) — challenge page with per-link OG tags ("{nickname} scored {score}. Can you beat them?") that starts the same round; after completion shows the side-by-side via `GET /api/round/:round_id/compare?me=<anon_id>&them=<player>` → `{me:{...}, them:{nickname, score, accuracy, mean_conf, overconfidence, type}}`. `player` is a short public token minted at complete time, never the anon_id.
- `GET /api/round/stats?date=` → `{players, score_hist, mean_overconfidence}` for the ranked round (cache 60 s).
- `POST /api/event` body `{type: "share"|"challenge_view"|"play_again", anon_id?, round_id?}` → `{ok}`; anonymous counters only.
- Chat platforms (Slack, Discord): `GET /api/round/daily-question?date=` → `{round_id: "dq-<date>", item_id, prompt, a, b}` (one global question per UTC day); answers via `/api/round/answer` with that round_id, surface=slack|discord and the prefixed community; a later answer to the same item by the same anon_id before the reveal replaces the earlier one when the body carries `revision: true`; `GET /api/round/reveal?date=&community=` → `{n, pct_a, pct_b, correct, a_value, b_value, unit, a_source, b_source, biggest_bluff:{anon_id, conf, choice}}` (the bot decides whether to name them: roast mode off → "someone was 95% sure…"). Full rounds inside chat (`/howsure play`) use the normal quick-round endpoints with surface=discord|slack.
- Communities in `/api/kpi` = distinct `community` values with ≥ 1 play in 30 days, reported per platform (workspaces, guilds, rooms).
- `GET /api/kpi` adds `rounds_per_player_day`, `d1_return`, `d7_return`, `challenge_conversion` (completed rounds / challenge views), `share_rate` (share events / completed rounds), each for the trailing 30 days.

Daily-item endpoints (`/api/daily/*`) remain for the full assessment and existing data; the home page no longer uses them.

Clarifications (2026-10-03, after the Slack build):
- Daily chat question rounds `dq-<date>` accept answers and revisions while `<date>` is today or yesterday (UTC); later → 409 `{error:"locked"}`. A revision without `revision: true` for an item already answered returns the first result (idempotent). The server does not know each community's reveal hour; bots refuse answers after their own reveal.
- `GET /api/round/daily-question?date=` accepts today or yesterday and returns that day's question; `GET /api/round/reveal` works for any past date.
- Status codes: 400 invalid body; 404 unknown round or item; 409 locked; 429 rate limited.
- Bot identity: the Slack and Discord workers send `x-howsure-bot: <BOT_KEY>` on every call (BOT_KEY is a shared secret set on the web project and on each bot). The WAF rate-limit rule on `/api/*` exempts requests carrying the right header.
- No early peeking: answers to `dq-<date>` rounds return `{locked:true, points_pending:true}` with no truth or points, whatever the surface; points are computed at reveal time. `GET /api/round/reveal` for today's date requires the bot header (403 otherwise); past dates are public.

