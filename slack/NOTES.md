# Builder notes: Who's Bluffing? for Slack

## First-game usability (2026-10-09)

Bare `/bluff` now opens a private Play solo / Play with friends launcher; signed button callbacks reuse the existing pickers and session guards. The manual daily post moves to `/bluff question`; scheduled daily posts, reveal and stats are unchanged. Install/help text and the manifest usage hint point to the new paths. No schema or scopes changed.

Only question one's confidence picker explains guessing/certainty and that a tap locks in. Feedback explicitly names the correct A/B option for both right and wrong answers. Check friends from a completed private result displays that round's finished standings locally, while still refreshing the current public lobby. It keeps Rematch and never joins anyone automatically.

Verified: 63 Slack tests pass, including signed launcher callbacks/retries, real round feedback, first-question-only guidance, private standings with unfinished/unjoined-player guards and all existing daily behavior under the explicit question command. Live Slack rendering remains a separate acceptance step.

## Native full rounds (2026-10-09)

`/bluff play` and `/bluff party` now use `play.js`, `play-store.js` and `play-ui.js`. The web-generated pack availability and labels drive the topic/difficulty picker; solo defaults to All/Normal, party to Memes/Normal. Both call the same web round/answer/complete API with `surface: slack` and existing salted identities. Per-answer feedback includes validated source links and a private Report question picker. Results use the web's short display labels.

Migration `0004_play.sql` must run before deployment. It adds temporary sessions and players. Sessions expire one hour after creation, and hourly cleanup runs first; no raw user/channel IDs or response URLs are stored in those tables. Joining a public party opts into a transient display name and public finished score. Anonymous API answers/results have their separate existing retention.

Leases serialize question/confidence/completion writes. The API's canonical choice/confidence and total handle a response lost after the API accepted an answer. Cached feedback and idempotent completion prevent repeated taps from adding points. Rematch uses the parent's settings and excludes the original ten; one child link converges concurrent retries, including interruption between linking and creating the child. Unfinished friends can still complete the original privately. Notices leave the game controls intact. Every click uses its own newly supplied response URL.

Daily fixes: fetch/JSON failures and malformed successful sends release the pending post claim and do not stop other workspaces. Open daily picks always send `revision: true`, so an accepted API write followed by a failed local save cannot leave the two stores on different choices.

Verified locally: 60 tests, including nine signed native-flow tests against the actual current question bank and real web scoring API on separate local SQLite. Solo, three-player party, source reporting, positive/negative scores, same-ten isolation, new-question rematches, unfinished-player continuity, expiry, spoofed/stale callbacks, overlapping taps and recovery after API/send/storage failure all pass. Wrangler dry-run bundles successfully (64.21 KiB, gzip 18.39 KiB). This is not a live Slack-client acceptance result; root performs that after deployment.

Slack delivery is not a transaction with D1. If Slack accepts a public message but its response is lost, retry may duplicate that message; no history-read scope is added to try to reconcile it. Scored API answer/completion retries remain idempotent. Platform 3-second acknowledgments and fresh per-click response URLs follow [Slack's interaction contract](https://docs.slack.dev/interactivity/handling-user-interaction/).

The sections below are historical v0.2 implementation evidence, not the current feature list.

v0.2 replaces the v0.1 modal game (Play button, 5-range modal, day board, `/api/daily` client) with one in-channel question a day, a private confidence picker, a reveal, a Monday recap and `/bluff reveal`.

## Brief vs contract: the contract (`docs/api-rounds.md`) was followed

1. **round_id.** The brief says `slack-{date}`; the contract says the id comes from `GET /api/round/daily-question?date=` (`dq-<date>`). The Worker never builds it: the post's buttons carry the returned `round_id` and `item_id`. The date is always passed, because the response has no date field.
2. **community.** The brief says "team hash"; the contract says `slack:<team hash>`. Sent as `slack:` + `sha256(team_id:SALT)`.
3. **Revisions.** A later answer before the reveal carries `revision: true` (sent only on a change of mind, when a stored answer exists; a first answer has no `revision`). The API refuses with 409 (locked: the question's day is over) or 404 (unknown round or item): the member sees "You're already locked in: B at 80%." for a change, "This question is closed." for a first answer. 400, 429, 5xx and timeouts show "taking a break" and keep the picker.
4. **No points before the reveal.** Answers to `dq-` rounds return `{locked: true, points_pending: true}`, no truth or points. The Worker stores A or B and the confidence and shows "Locked in" without points. At the reveal it scores the day's answers against the reveal's `correct` with the contract's formula, 100 − 400·(c − y)², computed in whole numbers as 100 − (conf − 100·y)² / 25 (exact for multiples of 10).
5. **Bot key.** Every call to the web API sends `x-bluff-bot: <BOT_KEY>` (new secret). Without `BOT_KEY` no call is made: members see "taking a break" and the log says `BOT_KEY is not set`.

## Deviations from the brief

1. **Stored beyond the brief's list**, each needed for a behaviour asked for, none personal:
   - `posts.item_id, prompt, a, b`: the day's question as served, saved at post time (coordinator request, as in the Discord bot). The reveal draws from it and never calls `daily-question`, which only serves today and yesterday. The app's own text, never member messages.
   - `answers.correct`, `answers.points`: filled in at the reveal. The recap's accuracy per confidence level needs `correct`: at 50% the points are 0 whether right or wrong.
   - `posts.channel_id`: the reveal edits the post where it is, even if setup moves the channel later that day.
   - `installs.recap_week` (a Monday date): the recap posts once per week, also when that day's question was posted by hand.
   - `installs.roast`, `posts.revealed`: asked for by the brief.
2. **Reveal time** = max(post hour, the hour the day's post actually went up) + 8 h. Same as the brief's "post_hour + reveal_delay" for every scheduled post; a late post (set up after the hour) gets the full 8 h instead of minutes. One function (`game.revealAt`) feeds the post, the "Locked in" reply and the cron. The post time is the Slack message `ts` (epoch seconds).
3. **Reveal delay was a constant (8 h)** in v0.2: the brief said "default 8 h" but gave no command to change it. `reveal N` sets it now (see "Local times and the reveal window").
4. **A failed reveal is retried hourly for up to 7 days** (the reveal endpoint serves any past date and the question is stored), instead of stopping after the question's next day.
5. **Roast off also leaves members with ≤ 0 points out of the named points list** (reveal and `/bluff stats`). Otherwise roast-off would still name people next to a loss. Roast on shows the plain top 5 / top 10.
6. **Bluff line:** "Someone was 90% sure it was B (the Danube). It wasn't." The brief's "the Nile is shorter" needs the opposite of the prompt's comparative, which the contract does not provide.
7. **Buttons read "A · the Nile" and "B · the Danube"** (brief: A / B), so nobody has to map letters to names. The letters still drive "Locked in: B at 80%" and "% A · % B".
8. **Migration `0002_daily_question.sql` is additive** (ALTERs plus `answers`), so it applies whether or not 0001 was ever applied. The v0.1 table `scores` stays, unused; drop it with a later migration if wanted. Not dropped here: unrequested destructive DDL.
9. **Not built:** `/bluff play` (full rounds in chat). The contract and PREREG mention it; the Slack brief does not list it.

## Definitions the brief left open

- **anon_id** = `sha256(team_id:user_id:SALT)` hex (unchanged from v0.1).
- **Bluff** = a wrong answer at 80% or more, for both the reveal line and the recap count (coordinator; matches Discord). The reveal line uses the API's `biggest_bluff` and is left out when there is none, it is under 80%, or its choice is the right answer.
- **Most calibrated** = smallest |mean confidence − accuracy| among members with at least 3 revealed answers that week; ties: more answers, then more points. Left out when nobody has 3.
- **Streak** = the workspace's run of consecutive days, up to the Sunday, with at least one revealed answer (looks back at most 365 days).
- **Recap week** = Monday to Sunday before the recap's Monday. Posted at the post hour, before that day's question. A week with no answers is claimed and skipped.
- **rt_ms** = time from the A/B tap to the confidence tap (the picker carries the tap time). Not comparable with web timing; PREREG's response-time exclusions apply to the web only.
- **Revealed days only:** stats, recap and streak count only revealed (and so scored) days.
- **Open window:** answers are taken while the day is unrevealed, and only for today's or yesterday's question (the API's own rule; a 20:00 post is revealed at 04:00 the next day). After the reveal, A/B taps and leftover pickers are refused locally, without calling the API (the API does not know each workspace's reveal hour).
- **The day's post:** `/bluff` in the chosen channel, or anywhere while no channel is chosen, becomes the day's post (the reveal edits it; the cron skips the day). A second `/bluff` in the day's post's channel says the question is already up instead of posting twice. Elsewhere it posts a copy whose answers count the same; copies are not edited at the reveal. `/bluff` after the day's reveal posts nothing.
- **Question text** = "{prompt without the question mark}: {a} or {b}?", unless the prompt already names both options (the contract does not say which form `prompt` takes).
- **Values:** a unit containing "year" prints without thousands separators or unit (1903); other values as "6,650 km". Sources print when the reveal carries them.
- **Failures:** a failed reveal or recap releases its claim and is retried at the next hourly run; `/bluff reveal` also retries. The confidence picker is kept on an outage so the member can tap again.
- **Confidence picker** labels: "50% · coin flip", 60%, 70%, 80%, 90%, "100% · stake it all" (the brief names only the two ends).

## Local times and the reveal window (2026-10-04)

The owner's problem: the post hour was a UTC integer and the reveal a fixed 8 hours later, so members elsewhere read "Reveal at 22:00 UTC" and had to convert, and a community spread over many zones lost everyone asleep during the 8 hours.

1. **Slack date tokens wherever a time is shown.** Each reader's client renders them in the zone of their own Slack profile; the fallback after `|` is UTC, for clients that cannot render them.
   - The reveal (often the next day): `<!date^UNIX^{date_short_pretty} {time}|Oct 31 22:00 UTC>`, on the post ("Nobody sees your answer before the reveal: today 10:00 PM.") and in "Locked in" / "You're already locked in" ("Reveal: tomorrow 4:00 AM.").
   - The daily hour: `<!date^UNIX^{time}|13:00 UTC>`, in the setup reply when the hour is UTC and in the command list's schedule line. A recurring hour uses today's date at that hour, so a reader's client applies the zone's current offset (daylight saving included).
2. **Setup in the admin's own time.** `/bluff setup #channel 9` means 09:00 in the zone of the member who runs it: `users.info` (already granted by `users:read`) gives `user.tz_offset` in seconds, and the UTC hour is stored as before (no schema change for the hour). The reply says both: "every day at 09:00 your time (13:00 UTC)".
   - `utc` after the hour (`setup #channel 9 utc`) skips the lookup and stores 9.
   - Without an hour the default stays 14:00 UTC, as before (the smaller change; the reply shows it in the member's own time too). The zone is looked up only when an hour is typed without `utc`, so `setup roast on` and `setup reveal N` make no extra call.
   - Any lookup failure (`ok: false`, no `tz_offset`, a network error) stores the hour as UTC and the reply starts "I couldn't read your time zone from Slack, so the hour is in UTC." The zone itself is never stored.
   - Zones a half or quarter hour off UTC round down to the full UTC hour (the cron runs on the hour). The reply converts the stored hour back, so it never claims a time that will not happen: India, `9` → 03:00 UTC → "08:30 your time".
   - The stored hour is UTC, so after a daylight-saving change the post moves an hour on the admin's clock until setup runs again. Storing a zone name instead would need a schema change and zone rules in the Worker; not done.
3. **`reveal N`** (2 to 23) in the grammar: `setup #channel [HH [utc]] [roast on|off] [reveal N]`, in that order, and `setup reveal N` or `setup roast on|off reveal N` without a channel. Stored in `installs.reveal_delay_h` (new nullable column, `migrations/0003_reveal_delay.sql`, additive); NULL means 8, so every existing workspace keeps 8. `revealAt` takes it, and `openPosts` now selects it for the cron. Out of range (1, 24, 99) shows the command list, like an hour of 24. 23 is the most because the API takes answers to a daily question only on its day and the next: post hour 23 + 23 hours is still the next day.
4. **Help.** The command list (`USAGE`) stays one fixed string, because `web/test/parity.test.js` matches its backticked commands against `web/public/commands.json`; it now names `[reveal N]` and says the hour is in your time zone. Once the workspace has a channel, the reply adds "This workspace: a question in #channel every day at {time}, the answer N hours later." That costs one D1 read before the immediate answer; a D1 error is logged and the plain list goes out.
5. **The setup reply** names the reveal window and how to change it ("reveal the answer 8 hours later (change it with reveal N, 2 to 23)").
6. **Known limit, not fixed:** the reveal time is worked out from the current settings (Discord stores a `reveal_at` per post instead). Changing the hour or `reveal N` after the day's post moves that day's reveal; the post and earlier "Locked in" replies keep the time they showed. Fixing it means a `posts` column for the promised reveal.
7. **Not changed:** `manifest.yaml`'s usage hint. "reveal" there is the subcommand; adding "reveal N" would read as the same word. The hand-drawn Slack mock on `web/public/slack.html` still shows "before the reveal at 22:00 UTC" (outside this change's files).
8. **Deploy order:** apply `0003_reveal_delay.sql` before deploying; the hourly run selects the new column.

Verified: 49 tests (9 new). Mutation check on a scratch copy: 10 deliberate bugs each turned the suite red (tz sign flipped, rounding to the nearest hour, `utc` ignored, bare setup read in the local zone, no lower reveal bound, reveal window ignored by the reveal time, `openPosts` without the column, setup dropping `reveal`, the reveal token without its day, the UTC fallback not reported). Not verified: a real Slack client rendering the tokens, and `users.info` returning `tz_offset` for a real member (both as documented by Slack).

## Acceptance (re-runnable)

```bash
cd slack
npm test
npx wrangler deploy --dry-run --outdir dist
grep -rn "console.log(" src    # expect no output
```

## Verified and not verified

- Verified: 40 tests with mocked Slack and a mocked rounds API that follows the current contract (locked answers without points, reveal with sources), against both migrations on SQLite. Wrangler 4.147.0 dry-run bundle (33.0 KiB). Mutation check: 33 deliberate bugs each turned a test red (among them: no bot header, BOT_KEY not required, question not stored, reveal calling daily-question, day never scored, wrong points formula, reveal retried one day only, bluff line under 80% or for a right answer, each claim taken twice or never released, revision always / never, 409 treated as an outage, unrevealed days in stats, roast off naming losses or looking up the bluffer, no signature check).
- Fixed on the way: name lookup crashed when `conversations.members` answered ok without a `members` list (v0.1 code).
- Not verified: real Slack (no login allowed) and the real rounds API. Block Kit layouts, ephemeral replacement through `response_url` (`replace_original: true` on the picker) and the button `text` echoed in `block_actions` payloads follow Slack's documentation as known to the builder and were not tried live.

## Open questions

1. **PRIVACY.md** (outside slack/): the Slack paragraph says "per-day scores keyed by a salted hash". It should say per-day answers (A or B, confidence; whether right and points from the reveal on) keyed by a salted hash of the member id, plus the roast setting per workspace.

Resolved by the contract update: reveal sources (now in the reveal response), refused-answer status (409 / 404), answering and revealing day D on D+1 (answers today or yesterday; reveal any past date; the reveal no longer calls `daily-question`), and who closes answers after a reveal (each bot, at its own reveal).
