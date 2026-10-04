# Builder brief — HowSure for Slack v0.2: one question a day, in-channel, with a reveal

You are the executor. Repo /Users/ethan/howsure; edit only slack/. Read first: docs/api-rounds.md (Slack section: daily-question, answer with surface=slack, reveal), slack/src/*, slack/README.md, slack/NOTES.md, prereg/PREREG.md (play = one in-channel answer), PRIVACY.md.

Hard rules: no git commands; no deploy/login; no runtime deps; never store raw member ids with answers (keep the salted hash), never store message text; respond to Slack within 3 s (ack, then work in waitUntil). Keep `npm test` green and extend it. Mock the web API in tests (another builder is implementing it in parallel; follow the contract exactly).

## Behaviour (replaces the modal game)
- Daily post at the workspace's hour: "HowSure · Which is longer: the Nile or the Danube?" with two buttons **A** / **B**. Tapping one sends an ephemeral confidence picker (50/60/70/80/90/100 as buttons, "coin flip" … "stake it all"). Confidence tap → `POST /api/round/answer` (surface=slack, community=team hash, round_id = `slack-{date}`) → ephemeral "Locked in: B at 80%. Reveal at 14:00 UTC." Changing your mind before the reveal is allowed (last answer wins; the API's idempotency is per item, so send a `revision` field and let the server keep the latest — confirm this with the contract owner: if the API rejects revisions, show "already locked in" instead).
- Reveal (at the next hourly tick after `post_hour + reveal_delay` (default 8 h) or `/howsure reveal` by anyone): update the original post: correct answer with both values and sources, "{n} answered · {pct_a}% A · {pct_b}% B", points table top 5 by name (names fetched at render time, never stored), and the bluff line. **Roast mode off by default**: "Someone was 95% sure the Nile is shorter. It isn't." **Roast mode on** (`/howsure setup roast on`): names the biggest bluffer. Store the roast flag per install.
- Weekly recap (Monday post): workspace calibration this week — accuracy at each confidence level, most calibrated player (named), "bluff count", streak of days played.
- Commands: `/howsure` (post today's question now), `/howsure setup #channel [HH] [roast on|off]`, `/howsure stats` (30-day leaderboard by points, participation), `/howsure reveal`.
- Store per day per team: post ts, revealed flag; per answer: anon hash, choice, conf, points (from the API response). Nothing else.

## Acceptance
- Tests: A/B button → ephemeral confidence picker; confidence → API call with the right payload; reveal composes the message (roast off/on); weekly recap; scheduled handler posts once per team per day and reveals once; signature verification unchanged; no raw ids or text stored.
- `npx wrangler deploy --dry-run --outdir dist` succeeds; README updated (commands, roast mode, reveal timing); NOTES records deviations.

## Report back (≤ 15 lines)
