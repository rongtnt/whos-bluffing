# Builder notes: HowSure for Slack v0.1

## Deviations from the brief

1. **Hourly cron (`0 * * * *`), not `0 14 * * *`.** A once-a-day trigger cannot honour `/howsure setup #channel [HH]`. Each run posts to installs whose `post_hour_utc` ≤ the current UTC hour and that have no post today. It claims the day first (`INSERT OR IGNORE` into `posts`) and releases the claim if the post fails, so the next hour retries and a repeated trigger posts nothing. Default hour is still 14.
2. **Added bot scope `users:read`.** The brief asks for display names via `users.info`, which needs that scope.
3. **Names by hash matching.** Only salted hashes are stored, so no stored id leads back to a member. While drawing a board, the worker hashes the board channel's members (`conversations.members`, first 1000) and calls `users.info` for the matches. Others show as "a teammate". Names are never stored.
4. **Extra files:** `package.json` and `package-lock.json` (wrangler as the only dev dependency, no runtime dependencies), and `test/helpers.js` (D1 fake on `node:sqlite` that runs the real migration, fetch mock, request signing).
5. **`posts.ts` is nullable:** NULL marks the cron's in-flight claim.

## Definitions the brief left open

- **anon_id** = `sha256(team_id + ":" + user_id + ":" + SALT)` hex, as the brief says. `docs/api-daily.md` writes `team_id + ":" + user_id + salt` (no colon before the salt). The web never recomputes it, so either works, but the two docs disagree. Open question.
- **community** = `sha256(team_id + ":" + SALT)` hex. Sent on both `/api/daily/answer` and `/api/daily/complete`. `docs/api-daily.md` lists no `community` field; `BRIEF_web_v4.md` stores `players.community`. Open question: which call does the web read it from?
- **rt_ms:** Slack reports no per-field timing. `rt_ms` = (submit time − modal open time) / 5, the same value on all five answers. Analysts should know Slack timings are averages.
- **Date:** the modal pins the UTC date it showed (in `private_metadata`), so a play opened at 23:59 and submitted at 00:01 answers the day it showed. Whether the web API accepts that late answer is up to the web side.
- **Result again, not a second play:** only hits are stored, not answers. The result is rebuilt by re-sending the five answers; the API is idempotent per (anon_id, date, item), so a repeat returns the first result. From the Play button the placeholder ranges are the items' `accept` bounds. This happens only when our `scores` row exists, which is written after a successful `complete`, so placeholders can never become real answers. `complete` is never called twice.
- **Private result** goes to the Play click's `response_url` (carried in `private_metadata`). It works in channels the app has not joined and lasts 30 minutes.
- **Channel leaderboard message = today's post.** After each completed play, `chat.update` edits today's post in the chosen channel (players, average, top 5). If there is no post yet, or the update fails, it posts a new one and records it. A manual `/howsure` in the chosen channel becomes today's post when none exists, so the cron skips that day. With no chosen channel there is no channel board; `/howsure stats` still works.
- **`/howsure stats`** is posted in the channel (the design doc calls for "a channel leaderboard (daily and 30-day)"). Names come from that channel's members. "Ties by plays" is read as more plays first. Participation = distinct members who played in 30 days, plus total games.
- **"Today's average so far"** in the post is the average across all HowSure players from `/api/daily/stats` (or `today` from `complete`). It is left out when nobody has played yet or the stats call fails. The workspace's own numbers are the board below it.
- **Setup checks the channel** with `conversations.info` (the `channels:read`/`groups:read` scopes). Unknown, archived, or private-without-invite channels are refused.
- **Uninstalled workspaces:** when the hourly post gets `token_revoked`, `account_inactive` or `invalid_auth`, the install row and its token are deleted.
- **OAuth:** a random `state` goes in an HttpOnly, Secure, SameSite=Lax cookie (10 minutes) and is checked on callback. Only `team.id` and the bot token are stored; `authed_user` is ignored. A reinstall keeps the channel and hour.
- **`API_BASE`** is the web origin without `/api`; the client appends `/api/daily…`.
- **Slack Web API calls** are form-encoded with the bearer token in the header. Every method accepts this, including read methods that reject JSON bodies.
- **Logging:** one `console.error` helper prints a tag plus an error code or message. Never request bodies, tokens or env values. A payload that fails to parse returns 400 unlogged, because JSON parse errors quote their input.

## Acceptance (re-runnable)

```bash
cd slack
npm test
npx wrangler deploy --dry-run --outdir dist
grep -rn "console.log(" src    # expect no output
```

## Verified and not verified

- Verified: 21 tests with mocked Slack and a mocked daily API, against the real migration SQL on SQLite. Wrangler 4.147.0 dry-run bundle (22.9 KiB). Mutation check: 8 deliberate bugs (no salt, no idempotency check, no signature check, no low ≤ high check, wrong tie order, no claim release, untracked manual post, no repeat check on submit) each turned a test red.
- Not verified: real Slack (no login allowed) and the real daily API (built in parallel). The Slack UI paths in the README (Manage Distribution, Revoke All OAuth Tokens) come from Slack's documentation as known to the builder and were not checked live. `number_input` accepting negatives and decimals is per the Block Kit docs, not tried live.
