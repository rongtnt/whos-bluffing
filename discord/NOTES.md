# Builder notes: Who's Bluffing? for Discord v0.1

## Ed25519 check (the brief asked: vendor a verifier only if Workers cannot verify)

Workers' `crypto.subtle` verifies Ed25519 natively, so **nothing is vendored**. Checked on 2026-10-03 with the workerd
binary that wrangler 4.147.0 installs (`workerd 2026-10-01`, `compatibility_date = "2026-09-01"`): a `workerd test`
worker imported a raw 32-byte public key with `{ name: 'Ed25519' }` and verified a signature made by Node's
`crypto.sign` over `timestamp + body`. Result: `valid=true tampered=false`. `src/verify.js` uses the same calls; the tests
run them under Node 22 against a real key pair.

## Deviations from the brief

1. **`/bluff question` instead of a bare `/bluff`.** Discord cannot run a command that has subcommands without
   one, so "post today's question now" is a subcommand. Everything else matches: `play`, `setup`, `stats`, `reveal`,
   `help`, `invite`.
2. **Response types.** Anything with I/O defers: commands with type 5 (private, except `stats`); button presses with
   **type 6** (deferred update), then `PATCH .../messages/@original`. Type 6 is the in-place version of type 5: the
   confidence picker turns into "Locked in", and the 10-question play flow stays in one private message instead of
   about 30. Answers that need no I/O are sent at once with type 4, well inside 3 s: the confidence picker after A/B,
   the public Challenge post, `help` and `invite`.
3. **Schema additions** (`migrations/0001_init.sql`):
   - `posts.channel_id`: the reveal edits the post where it was made, even after `setup` changes the channel.
   - `posts.reveal_at`: the hourly tick at or after post time + `reveal_delay_h` (14:00 → 22:00; a 14:37 manual post → 23:00).
   - `posts.prompt`, `posts.a`, `posts.b`: the day's question as the API served it (the same for every server). Without
     these, a reveal delayed past yesterday could never be drawn, because `daily-question` only serves today and
     yesterday. This is the app's own text, never member messages.
   - `answers.correct`: needed for calibration. At 50% confidence, points are 0 whether right or wrong.
     `answers.points` and `answers.correct` are NULL until the reveal settles them (see below).
   - `play_state.items`: the round's 10 questions (prompt and options only). No API call returns a round by id.
   - `installs.last_recap`: makes the Monday recap happen once per server per week.
4. **`setup` and `reveal` need Manage Server (or Administrator)**, checked in code from `member.permissions`. Discord
   cannot restrict a single subcommand, and an open `setup` lets any member move the bot or switch roast mode on. Any
   member can still answer, play, see stats and invite.
5. **Names need Discord's Server Members Intent.** Only salted hashes are stored, so no stored id leads back to a
   member. While drawing a leaderboard, the worker lists the server's members (`GET /guilds/{id}/members?limit=1000`),
   hashes each id, and uses the display names of the matches (`nick`, else `global_name`, else `username`). That
   endpoint needs the privileged Server Members Intent (Developer Portal → Bot). Without it Discord answers 403 and
   everyone shows as "a member"; the roast line falls back to "Someone". Past 100 servers Discord requires app
   verification, and the intent must be justified again then (suggested wording in the README).
6. **The daily top 5 lists positive scores only.** Otherwise, with roast mode off, a bluffer's named −224 next to the
   anonymous bluff line would give them away. The 30-day board shows everyone.
7. **Bluff = a wrong answer at 80% or more**, used for both the reveal's bluff line and the recap's bluff count. The
   API may return a 50% miss as the biggest bluff; it is not shown. The brief's "95% sure" example is not possible on
   the 50/60/…/100 scale.

## Contract clarifications applied (coordinator message, 2026-10-03)

- `GET /api/round/reveal` returns `a_source`/`b_source`, so the reveal shows them directly.
- `dq-<date>` takes answers while the date is today or yesterday (UTC). After that the API answers 409
  `{error:"locked"}`. On 409 the member sees "Already locked in: B at 80%…" with their stored answer, or "Too late:
  answers for this question are closed." if they have none. The stored answer is not changed.
- The bot refuses answers itself once its own reveal has happened (`posts.revealed`). There is no API call in that case.
- 400, 404 and 429 are treated as "taking a break". A failed reveal is retried at the next hourly tick.

## Contract follow-ups applied (coordinator message 2, 2026-10-03)

- **Bot key:** every call to the web API carries `x-bluff-bot: <BOT_KEY>` (new secret). It is required for
  same-day reveals and exempt from the `/api/*` rate limit. If BOT_KEY is missing, the worker fails fast: no call is
  sent, the log says `BOT_KEY is not set`, and members see "taking a break". The test mock answers 403 to any API call
  without the header, so every test checks it.
- **No early peeking:** answers to `dq-<date>` come back `{locked: true, points_pending: true}`. The bot stores choice
  and confidence only and shows "Locked in: B at 80%. Reveal at 22:00 UTC." (it never showed points). At the reveal
  it settles every answer of that server and day from the reveal's `correct`, using the contract's rule
  `100 − 400·(c − y)²`. The top 5, the 30-day board and the recap read those settled points. Values and sources come
  from the reveal response. The reveal gives no per-member points, so the bot computes them; the API computes the same
  numbers from the same rule.
- **Pending answers** count for the streak (a day with an answer) but not for the 30-day board or the recap's
  calibration, which read revealed answers only.
- The migration (never deployed) was edited in place rather than given a 0002.

## Definitions the brief left open

- **anon_id** = hex `sha256(guild_id + ":" + user_id + ":" + SALT)`, exactly as the brief says.
- **community** = `"discord:" + hex sha256(guild_id + ":" + SALT)`, sent with every answer and `complete`.
- **rt_ms, daily question:** picker shown → confidence tap, from the two Discord snowflake timestamps (picker message
  id, interaction id). It leaves out reading the question and the A/B tap, so it is a partial decision time.
- **rt_ms, `/bluff play`:** question shown → confidence tap, from the worker clock. It includes the A/B tap and one
  round trip.
- **Revisions:** a member who changes their mind before the reveal gets `revision: true` on the second and later
  answers, and their stored row is replaced. The first answer never carries the flag.
- **One post per server per day.** `/bluff question` posts in the current channel only when the server has no post
  today; otherwise it links to the existing one. A manual post before the server's hour becomes the day's post, and the
  hourly tick skips that day.
- **Posts and reveals** use the bot token and plain channel messages (`POST`/`PATCH /channels/{id}/messages`), never
  interaction responses, because those cannot reliably be edited 8 hours later. The reveal removes the A/B buttons.
- **Setup:** every option is optional; a missing one keeps its value. A server with no channel gets the current
  channel. A new channel gets a one-line hello, which is also the check that Who's Bluffing may post there (403/404 →
  "I can't post in that channel", nothing saved). `reveal_delay_h` had no command in v0.1 (default 8); the `reveal`
  option sets it now (see "Local times and the reveal option").
- **A lost channel:** when the daily post gets 403 or 404, the server's channel is cleared and posting stops until
  someone runs `/bluff setup` again. Other failures (429, 5xx) release the day's claim and retry the next hour.
- **Weekly recap:** Mondays at the server's hour, before that day's question. It covers the 7 days before. It is
  skipped when nobody answered, and is best effort (a failed recap is not retried that week). "Most calibrated" is
  the member with 3 or more answers and the smallest gap between average confidence and hit rate; ties go to more
  answers, then more points. The streak is consecutive days with at least one answer, ending Sunday.
- **`/bluff stats`** is a public reply (Slack does the same): top 10 by points over 30 days, ties to more answers,
  plus members, answers and active days.
- **`/bluff play`:** one active round per member per server, and Play again replaces it. A button from an older
  round says the round has ended. Two taps landing at once count once: conditional `UPDATE … WHERE step = ?`. The
  final "See your score" claims the round before calling `complete`, so a double tap never completes twice; a failed
  `complete` releases the claim. No `seen` list is sent, so repeats are possible but rare among 20,000+ pairs. No
  nickname is sent to the API (no names leave Discord), so the challenge page says "Someone". The Challenge post in
  the channel names the player in plain text, read from that button press (no `<@id>` mention, so no ping and no
  dependence on each viewer's member cache).
- **`accuracy` and `mean_conf`** from `complete` are read as percentages (0–100), as the contract's `share_text` uses them.
- **Bluff line wording** comes from the prompt: "Which is/was X" → "{pick} is/was X. It isn't/wasn't.", and "Which
  came first" → "… came first. It didn't." Anything else gets "it was {pick}. It wasn't."
- **Safety:** every message and edit carries `allowed_mentions: {parse: []}`. Display names and API text are
  markdown-escaped (`\ * _ ~ \` | < > [ ] @`), so a member called `@everyone` neither pings nor formats. Discord
  REST calls send `User-Agent: DiscordBot (<API_BASE>, 0.1)`.
- **Logging:** one `console.error` helper prints a tag plus a status or message. It never prints bodies, tokens or env
  values.
- **Extra files:** `package.json` and `package-lock.json` (wrangler as the only dev dependency, no runtime
  dependencies), and `test/helpers.js` (a D1 fake on `node:sqlite` running the real migrations in order, the fetch
  mock, and signed requests from a real Ed25519 key pair).

## Install events (`POST /events`, 2026-10-04)

Interactions carry no install notice, so a server used to be registered only at its earliest command, and an admin
who added the bot and ran nothing never heard from it. Discord's webhook events report installs over plain HTTP, so
the Worker still needs no gateway connection.

**Payload**, checked against Discord's docs source (`developers/events/webhook-events.mdx` in
`discord/discord-api-docs`, main branch, read 2026-10-04; published at
https://docs.discord.com/developers/events/webhook-events). Field names and types as documented, comments mine:

```jsonc
{
  "version": 1,                       // always 1
  "application_id": "<snowflake>",
  "type": 1,                          // 0 = PING, 1 = an event
  "event": {                          // present when type is 1
    "type": "APPLICATION_AUTHORIZED", // or "APPLICATION_DEAUTHORIZED", "ENTITLEMENT_CREATE", ...
    "timestamp": "2024-10-18T14:42:53.064834",  // ISO8601, when the event happened (the docs' example value)
    "data": {
      "integration_type": 0,          // optional: 0 = server install, 1 = installed to a member's own account
      "scopes": ["applications.commands", "bot"],
      "user": { },                    // the member who authorized the app (a user object)
      "guild": { }                    // a guild object; only when integration_type is 0
    }
  }
}
```

`APPLICATION_DEAUTHORIZED` is documented with `data: { "user": { } }` only: no guild and no integration_type.

Response rules from the same page: answer every event with 204 and an empty body within 3 seconds; a PING answer needs a
valid Content-Type; an unanswered event is retried with exponential backoff for up to 10 minutes, and an app that
fails too often stops getting events (Discord emails the owner). The signature is the same Ed25519 pair of headers as
interactions, checked on every request; Discord probes with bad signatures and removes a URL that does not answer 401.

**Handling** (`events` in `src/index.js`):

- The same check as `/interactions`: both routes go through `signedJson` (size limit, `verifyDiscord`, JSON parse).
- PING (type 0) → 204. `APPLICATION_AUTHORIZED` with a `guild.id` and an `integration_type` other than 1 → register the
  server and post the welcome. Everything else → 204, ignored: an error status would make Discord retry and, in the
  end, drop the URL.
- The D1 write runs before the 204, so a D1 failure answers 500 and Discord retries. The Discord calls run in
  `ctx.waitUntil` after the 204.
- Nothing from `user` is read or stored.

**Idempotency key: `(guild_id, event.timestamp)`**, kept in the new column `installs.welcomed`
(`migrations/0002_install_events.sql`). One statement registers the server and claims the welcome:

```sql
INSERT INTO installs (guild_id, installed_at, welcomed) VALUES (?, ?, ?)
ON CONFLICT(guild_id) DO UPDATE SET welcomed = excluded.welcomed WHERE installs.welcomed IS NOT excluded.welcomed
```

It changes one row for a new server or a new install event, and none for a retry of an event already handled (a retry
is the same event, so the same timestamp). The welcome is posted only when a row changed. A known server keeps its
channel, hour and roast setting. The docs give webhook events no id; the timestamp is the stable field there is.

**Channel choice** (`welcomeGuild` in `src/commands.js`): `GET /guilds/{id}` with the bot token → `system_channel_id`.
If that is unset or the post there fails, `GET /guilds/{id}/channels` → text channels (type 0), the system channel left
out, sorted by `position`. `POST /channels/{id}/messages` goes down that order and stops at the post that returns 2xx;
after 3 posts in all it stops without logging, since a server where Who's Bluffing may not write anywhere is fine. A
thrown error (network) is logged with a short reason only.

**Deviations from the brief:**

1. **Portal location.** The docs put the setting on the app's **Webhooks** page (Endpoint URL, Events toggle, event
   list, Save Changes), not under General Information. The README follows the docs.
2. **`APPLICATION_DEAUTHORIZED` names no server.** Its documented data is `user` only, and the docs describe it as a
   member revoking the app's authorization (token revocation, User Settings → Authorized Apps, account bans). So the
   handler clears a server's channel only if the payload carries a `guild.id`, which the docs do not promise. Removed
   servers are still noticed as before: the next daily post gets 403/404 and the channel is cleared.
3. **"Inactive" means no channel** (`store.clearChannel`), not a new column: `dueInstalls` and `recapInstalls` already
   skip `channel_id IS NULL`. `/bluff setup` makes the server active again.
4. **Copy:** a bare `/bluff` cannot run, so the welcome says `/bluff setup channel:#channel` and `/bluff play`.
5. **`integration_type` is optional in the docs,** so the check is "a guild is present and the type is not 1" rather
   than "the type is 0". User installs (type 1) are ignored either way.
6. If Discord sends a new `APPLICATION_AUTHORIZED` for a server that still has the bot (a re-authorization), it is a
   new event, and the welcome goes out again.

**Verified:** 9 new tests in `test/events.test.js` (45 in all) with mocked Discord. Mutation check on a scratch copy:
12 deliberate bugs in the new code each turned the suite red (no idempotency gate, key not the event timestamp, no
3-post cap, no position sort, system channel retried, non-text channels tried, user installs handled, deauthorize
ignored, Discord awaited before the 204, no signature check, 200 instead of 204, posting on after the system channel
took it). Two mutants survived as equivalent for any documented input: ignoring the outer `type` (a PING carries no
`event`) and reading a failed GET's JSON body (the error body has no `system_channel_id` and is not an array).

**Not verified:** real Discord (no login). That a retry carries the same `timestamp` is inferred from what the field means
(the time of the event), not stated in the docs. The `GET /guilds/{id}` right after the event assumes the bot user has
joined by then; if not, the GETs fail, the welcome is skipped quietly, and the server is still registered.

## Local times and the reveal option (2026-10-04)

The owner's problem: the post said "Answer at 22:00 UTC", so members elsewhere had to convert, and a fixed 8-hour window
lost everyone in a global server who was asleep during it.

1. **Discord timestamps wherever a time is shown.** Each member's app renders them in their own zone.
   - The reveal, often on the next day: `<t:UNIX:t> (<t:UNIX:R>)`, read as "10:00 AM (in 20 hours)": on the post
     ("Answer at …"), "Locked in" / "Already locked in" ("Reveal at …") and the reply to `/bluff question`.
   - The daily hour: `<t:UNIX:t>` in the channel hello and in `/bluff help`; in the setup reply followed by the UTC
     hour, because the admin typed the hour in UTC ("every day at 9:00 AM (09:00 UTC)"). A recurring hour uses today's
     date at that hour, so the reader's app applies the zone's current offset (daylight saving included).
   - The `hour` option stays in UTC: interactions carry no time zone.
2. **`reveal` option** on `/bluff setup`: INTEGER, `min_value` 2, `max_value` 23, wired to `installs.reveal_delay_h`; a
   missing option keeps the stored value, like the others. Discord enforces the range from the registered definition, so
   the code does not check it again (the same as `hour`). 23 is the most because the API takes answers to a daily
   question only on its day and the next. Each post stores its `reveal_at`, so a change applies from the next post.
3. **New servers start at 20 hours; existing rows keep 8. No migration.** The brief asked for an additive migration that
   only changes the column's DEFAULT. SQLite (and so D1) has no `ALTER COLUMN … SET DEFAULT` (checked: a syntax error in
   SQLite 3.51); changing a default means rebuilding the table (create, copy, drop, rename), which is not additive and
   not safe beside a live hourly run. So both insert paths write the value: `ensureInstall` (a server's earliest command)
   and `claimWelcome` (the install event; the INSERT part only, so a re-install keeps the stored delay). Every existing
   row holds the 8 it was inserted with. The schema's `DEFAULT 8` no longer applies to any code path.
   `NEW_REVEAL_DELAY_H = 20` lives in `src/game.js`; `test/helpers.js` stores 8 for its servers, as rows stored earlier hold.
4. **`/bluff help` is per server now:** where and when the question goes (once a channel is set) and the server's own
   reveal delay. One D1 read, no Discord call, so it is still answered at once (type 4).
5. **The setup reply** states the reveal delay ("reveals the answer 20 hours later").
6. **Re-register the command** after deploying: `cd discord && DISCORD_APP_ID=<application id> DISCORD_BOT_TOKEN=<bot token>
   npm run register`. Until then Discord offers `/bluff setup` without `reveal`; nothing else depends on it.
7. **Not changed:** the hand-drawn Discord mock on `web/public/discord.html` still shows "Answer at 22:00 UTC" (outside
   this change's files).

Verified: 49 tests (4 new, others updated). Mutation check on a scratch copy: 8 deliberate bugs each turned the suite red
(the install event or the earliest command writing 8, a re-install overwriting the stored delay, setup ignoring `reveal`,
no relative timestamp, the wrong timestamp style, help ignoring the server's delay, the option's bounds). Not verified: a
real Discord client rendering the timestamps (Discord's documented `<t:…:t>` and `<t:…:R>` styles).

## Type names (2026-10-04)

The `/bluff play` end screen names the player's type as the web does (`web/public/types.js`): Bluffer, Too sure, Spot on,
Too modest, Playing it safe, each followed by its one-line meaning ("Spot on · Your confidence matches how often you're
right, within 5 points."). The API's keys (`Hot-headed`, `Calibrated`, `Modest`, `Hedger`) and stored values are unchanged;
a type the bot does not know shows as the API sent it. This is the only place either bot shows a type. The recap's
"Most calibrated" names the member closest to their own confidence; it is not a type and keeps its wording.

## Open questions (outside discord/, not changed)

- **PRIVACY.md** covers Discord in its "Slack and Discord" paragraph (line 21), so the earlier open question is closed.
  It does not mention the install time or the welcome timestamp; both describe the server, not a member.
- Resolved by the contract follow-ups: the rate-limit concern (the `x-bluff-bot` header is exempt) and early
  peeking (`dq-` answers no longer return the truth).
- **PREREG's MAU definition** lists "an in-channel Slack answer". `docs/api-rounds.md` counts a Discord in-channel
  answer as a play too, so the definition should say Slack or Discord.

## Acceptance (re-runnable)

```bash
cd discord
npm test
npx wrangler deploy --dry-run --outdir dist
grep -rn "console.log(" src                                         # expect no output
grep -n -i -E "user_id|username|global_name|nick" src/store.js migrations/*.sql   # expect no output
```

## Verified and not verified

- Verified (v0.1; install events are covered in their own section above): 36 tests with mocked Discord and a mocked rounds API, against the real migration on SQLite. The wrangler
  4.147.0 dry-run bundle builds. Ed25519 was checked in workerd. Mutation check: 24 deliberate bugs, each of which
  turned the suite red:
  - no salt; no bot key header; no signature check; no revision flag
  - wrong points rule at settle; reveal never settles points; pending answers on the 30-day board
  - negative scores in the daily top; reveal never marked; double tap answered twice; completion counted twice
  - lost channel retried forever; failed post keeps its claim; setup open to all
  - no bluff threshold; roast off names; weak escaping; streak counts the recap day
  - answers after the reveal; failed score fetch locks the round; recap every day
  - daily rt_ms not measured; 409 treated as an outage; reveal drops sources
- Not verified: real Discord (no login allowed) and the real rounds API (built in parallel). Developer Portal labels,
  top.gg and App Directory steps in the README come from those services' documentation as known to the builder and
  were not checked live. Discord-side rendering (subtext `-#`, masked links with `<url>`) follows Discord's documented
  markdown and was not seen in a client.
