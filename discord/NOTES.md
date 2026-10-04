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
  "I can't post in that channel", nothing saved). There is no command for `reveal_delay_h` (default 8). The column
  exists for a later version.
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
  dependencies), and `test/helpers.js` (a D1 fake on `node:sqlite` running the real migration, the fetch mock, and
  signed requests from a real Ed25519 key pair).

## Open questions (outside discord/, not changed)

- **PRIVACY.md has no Discord section.** It is needed for verification and the App Directory. Suggested text:
  "**Discord:** the Discord app stores, per server, the server id, the chosen channel, the posting hour, the roast
  setting, its own daily posts, and per-day answers (choice, confidence, points) keyed by a salted hash of the member
  id. It never stores messages, usernames or member ids. Display names are fetched from Discord only while drawing a
  leaderboard."
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
grep -n -i -E "user_id|username|global_name|nick" src/store.js migrations/0001_init.sql   # expect no output
```

## Verified and not verified

- Verified: 36 tests with mocked Discord and a mocked rounds API, against the real migration on SQLite. The wrangler
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
