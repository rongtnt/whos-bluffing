# Builder brief — Who's Bluffing? for Discord v0.1 (the install-once channel that scaled Truth or Dare)

You are the executor. Repo /Users/ethan/howsure; create and edit only discord/ (plus posts/discord-listing.md). Read first: docs/api-rounds.md (you consume it; mock it in tests — the web builder implements it in parallel), prereg/PREREG.md (play and community definitions), PRIVACY.md, slack/ (the Slack worker is the sibling; copy its structure, store and test style where it fits; do not edit it).

Hard rules: no git commands; no deploy/login/purchases; no runtime npm deps (Cloudflare Workers runtime; vendor an Ed25519 verifier with its licence only if `crypto.subtle` cannot verify Discord's signatures in Workers — check first and record it in NOTES). Never store raw Discord user ids with answers: anon_id = hex sha256(guild_id + ":" + user_id + ":" + SALT); never store message text or usernames (fetch display names at render time only). Respond to interactions within 3 s (defer with type 5, then edit via the webhook). Plain English; no "first/largest"; no mention of AI.

## Product
- Daily question in a channel at the server's hour: "Who's Bluffing? · Which is longer: the Nile or the Danube?" with buttons **A** / **B**; tapping one shows an ephemeral confidence picker (50 … 100: "coin flip" … "stake it all"); confidence → `POST /api/round/answer` (round_id from `/api/round/daily-question`, surface=discord, community=`discord:<guild hash>`; revisions before the reveal use `revision: true`) → ephemeral "Locked in: B at 80%. Reveal at 20:00 UTC."
- Reveal (hourly tick after post + reveal delay, default 8 h, or `/bluff reveal`): edit the original message: correct answer with both values and sources, "{n} answered · {pct_a}% A · {pct_b}% B", top 5 by points (names rendered live), and the bluff line — **roast mode off by default** ("Someone was 95% sure the Nile is shorter. It isn't."); `/bluff setup roast on` names the bluffer.
- `/bluff play`: a full 10-question quick round inside Discord as an ephemeral flow (buttons A/B → confidence buttons → reveal text with points → next), using the quick-round endpoints with surface=discord; end with score, type, roast line, and a "Challenge" button that posts the challenge link to the channel if the player wants.
- `/bluff` (post today's question now), `/bluff setup #channel HH [roast on|off]`, `/bluff stats` (30-day leaderboard, participation), `/bluff reveal`, `/bluff help`, `/bluff invite`.
- Weekly recap on Mondays (calibration by confidence level, most calibrated member named, bluff count, streak).

## Files
```
discord/wrangler.toml        Worker "whosbluffing-discord"; D1 binding DB; [triggers] crons = ["0 * * * *"]; vars API_BASE, DISCORD_APP_ID
discord/src/index.js         routes: POST /interactions (verify, route), GET /install (redirect to the OAuth2 authorize URL with scopes bot+applications.commands and minimal permission bits: Send Messages, Embed Links, Read Message History), scheduled() handler
discord/src/verify.js        Ed25519 verification of X-Signature-Ed25519 / X-Signature-Timestamp
discord/src/commands.js      slash command definitions (exported for the register script) and handlers
discord/src/game.js          message/component builders: question post, confidence picker, reveal, play flow, recap, leaderboard
discord/src/api.js           client for docs/api-rounds.md; anon_id as above
discord/src/store.js         D1: installs(guild_id PK, channel_id, post_hour_utc, reveal_delay_h, roast INTEGER, installed_at), posts(guild_id, date, message_id, revealed INTEGER), answers(guild_id, anon_id, date, choice, conf, points), play_state(anon_id, round_id, step, total, updated_at)
discord/migrations/0001_init.sql
discord/scripts/register-commands.mjs   registers global slash commands with DISCORD_APP_ID + DISCORD_BOT_TOKEN (the user runs it once)
discord/test/*.test.js       node:test with mocked fetch: signature verify (valid/invalid/stale), PING→PONG, A/B → picker, confidence → API payload, reveal roast off/on, play flow state machine, scheduled posts once per guild per day and reveals once, install redirect scopes
discord/README.md            create the app at discord.com/developers, secrets (DISCORD_PUBLIC_KEY, DISCORD_BOT_TOKEN, SALT, API_BASE), set the Interactions Endpoint URL, register commands, invite link, how to list on top.gg and the App Directory
discord/NOTES.md
posts/discord-listing.md      top.gg / App Directory copy (short + long description, tags), modelled on truthordarebot.xyz's clarity, no false claims
```

## Acceptance
`npm test` in discord/ green; `npx wrangler deploy --dry-run --outdir dist` succeeds; grep for raw ids/names in storage code → none; README complete enough for a 20-minute setup.

## Report back (≤ 15 lines)
