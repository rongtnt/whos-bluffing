# Builder brief — HowSure for Slack v0.1

You are the executor. Repo /Users/ethan/howsure. Read first: docs/design-v4-scale.md, docs/api-daily.md (you consume this API; mock it in tests), prereg/PREREG.md (metric definitions), PRIVACY.md.

Hard rules: no git commands; no deploy/login/purchases; edit only slack/ (new folder). No runtime npm dependencies (Cloudflare Workers runtime, fetch and WebCrypto only). Never store raw Slack user ids with answers: hash them (see below). Never store message text. Plain English copy. No "first/largest" claims; no mention of AI in user-facing copy.

## Goal
A Slack app on a Cloudflare Worker: a workspace installs it once; every day it posts the HowSure daily game to a chosen channel; members play in a modal; the channel gets a leaderboard. Workspace = community; a member counts toward MAU when they complete a play.

## Files
```
slack/wrangler.toml            Worker "howsure-slack"; D1 binding DB; [triggers] crons = ["0 14 * * *"]; vars: API_BASE
slack/manifest.yaml            Slack app manifest: slash command /howsure, interactivity, OAuth redirect, bot scopes: commands, chat:write, chat:write.public, channels:read, groups:read
slack/src/index.js             router: /slack/oauth/start, /slack/oauth/callback, /slack/events (interactivity + slash), scheduled() handler
slack/src/verify.js            Slack signing-secret verification (v0=HMAC-SHA256, 5-minute replay window)
slack/src/game.js              build the daily post, the play modal (5 low/high pairs with units), result ephemeral, leaderboard message
slack/src/api.js               client for docs/api-daily.md (fetch to API_BASE); anon_id = sha256(team_id + ":" + user_id + ":" + SALT) hex
slack/src/store.js             D1: installs(team_id PK, bot_token, channel_id, post_hour_utc, installed_at), posts(team_id, date, ts), scores(team_id, anon_id, date, hits)
slack/migrations/0001_init.sql
slack/test/*.test.js           node:test with mocked fetch: signature verify (valid/invalid/stale), slash /howsure → posts game, modal submit → 5 answers + complete → ephemeral result; leaderboard ordering; scheduled() posts to every install once per day (idempotent via posts table); OAuth callback stores token
slack/README.md                create-app-from-manifest steps, secrets to set (SLACK_CLIENT_ID, SLACK_CLIENT_SECRET, SLACK_SIGNING_SECRET, SALT, API_BASE), deploy commands, how a workspace installs ("Add to Slack" URL), how to pick the channel (/howsure setup #channel), limits
slack/NOTES.md
```

## Behaviour
- OAuth v2 install: `/slack/oauth/start` redirects to Slack with scopes; callback exchanges code, stores bot token per team (D1; note in README that tokens are stored in D1 and how to rotate).
- `/howsure setup #channel [HH]` sets the channel and the UTC post hour (default 14). `/howsure` posts today's game to the current channel. `/howsure stats` shows the workspace's 30-day leaderboard (top 10 by total hits, ties by plays) and participation count.
- Daily post (cron and manual): "HowSure #12 — 5 questions, give a range you're 90% sure about. Today's average so far: 2.8/5." with a **Play** button. Play opens a modal: 5 blocks, each prompt + unit + two number inputs (low, high). Submit → validate low ≤ high → call `/api/daily/answer` ×5 then `/api/daily/complete` (surface=slack, anon_id as above, community=team hash) → ephemeral result to the user with the 🟩🟥 grid and each truth + source → update (or post) the channel leaderboard message for today: players, average, top 5 hits (display names via `users.info` at render time only; never stored).
- Idempotent: a member who already completed today gets their result again, not a second play.
- Error handling: API down → ephemeral "HowSure is taking a break, try again in a minute"; never leak stack traces; respond to Slack within 3 s (ack first, do work with `ctx.waitUntil`).
- Privacy: store only team_id, channel_id, bot token, post hour, post timestamps, and per-day hits keyed by the hashed member id. No message text, no emails, no names.

## Acceptance
- `npm test` in slack/ green (all cases above with mocked Slack and mocked daily API).
- `npx wrangler deploy --dry-run --outdir dist` succeeds (no real deploy).
- grep slack/src for "console.log(" of request bodies → none; tokens never logged.
- README complete enough that the user can create the app from the manifest and install it in 15 minutes.

## Report back (≤ 20 lines)
What exists, verbatim test summary, the exact secrets/vars the user must set, deviations, open questions.
