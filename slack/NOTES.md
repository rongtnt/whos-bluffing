# Builder notes: HowSure for Slack v0.2

v0.2 replaces the v0.1 modal game (Play button, 5-range modal, day board, `/api/daily` client) with one in-channel question a day, a private confidence picker, a reveal, a Monday recap and `/howsure reveal`.

## Brief vs contract: the contract (`docs/api-rounds.md`) was followed

1. **round_id.** The brief says `slack-{date}`; the contract says the id comes from `GET /api/round/daily-question?date=` (`dq-<date>`). The Worker never builds it: the post's buttons carry the returned `round_id` and `item_id`. The date is always passed, because the response has no date field.
2. **community.** The brief says "team hash"; the contract says `slack:<team hash>`. Sent as `slack:` + `sha256(team_id:SALT)`.
3. **Revisions.** A later answer before the reveal carries `revision: true` (sent only on a change of mind, when a stored answer exists; a first answer has no `revision`). The API refuses with 409 (locked: the question's day is over) or 404 (unknown round or item): the member sees "You're already locked in: B at 80%." for a change, "This question is closed." for a first answer. 400, 429, 5xx and timeouts show "taking a break" and keep the picker.
4. **No points before the reveal.** Answers to `dq-` rounds return `{locked: true, points_pending: true}`, no truth or points. The Worker stores A or B and the confidence and shows "Locked in" without points. At the reveal it scores the day's answers against the reveal's `correct` with the contract's formula, 100 − 400·(c − y)², computed in whole numbers as 100 − (conf − 100·y)² / 25 (exact for multiples of 10).
5. **Bot key.** Every call to the web API sends `x-howsure-bot: <BOT_KEY>` (new secret). Without `BOT_KEY` no call is made: members see "taking a break" and the log says `BOT_KEY is not set`.

## Deviations from the brief

1. **Stored beyond the brief's list**, each needed for a behaviour asked for, none personal:
   - `posts.item_id, prompt, a, b`: the day's question as served, saved at post time (coordinator request, as in the Discord bot). The reveal draws from it and never calls `daily-question`, which only serves today and yesterday. HowSure's own text, never member messages.
   - `answers.correct`, `answers.points`: filled in at the reveal. The recap's accuracy per confidence level needs `correct`: at 50% the points are 0 whether right or wrong.
   - `posts.channel_id`: the reveal edits the post where it is, even if setup moves the channel later that day.
   - `installs.recap_week` (a Monday date): the recap posts once per week, also when that day's question was posted by hand.
   - `installs.roast`, `posts.revealed`: asked for by the brief.
2. **Reveal time** = max(post hour, the hour the day's post actually went up) + 8 h. Same as the brief's "post_hour + reveal_delay" for every scheduled post; a late post (set up after the hour) gets the full 8 h instead of minutes. One function (`game.revealAt`) feeds the post, the "Locked in" reply and the cron. The post time is the Slack message `ts` (epoch seconds).
3. **Reveal delay is a constant (8 h).** The brief says "default 8 h" but gives no command to change it.
4. **A failed reveal is retried hourly for up to 7 days** (the reveal endpoint serves any past date and the question is stored), instead of stopping after the question's next day.
5. **Roast off also leaves members with ≤ 0 points out of the named points list** (reveal and `/howsure stats`). Otherwise roast-off would still name people next to a loss. Roast on shows the plain top 5 / top 10.
6. **Bluff line:** "Someone was 90% sure it was B (the Danube). It wasn't." The brief's "the Nile is shorter" needs the opposite of the prompt's comparative, which the contract does not provide.
7. **Buttons read "A · the Nile" and "B · the Danube"** (brief: A / B), so nobody has to map letters to names. The letters still drive "Locked in: B at 80%" and "% A · % B".
8. **Migration `0002_daily_question.sql` is additive** (ALTERs plus `answers`), so it applies whether or not 0001 was ever applied. The v0.1 table `scores` stays, unused; drop it with a later migration if wanted. Not dropped here: unrequested destructive DDL.
9. **Not built:** `/howsure play` (full rounds in chat). The contract and PREREG mention it; the Slack brief does not list it.

## Definitions the brief left open

- **anon_id** = `sha256(team_id:user_id:SALT)` hex (unchanged from v0.1).
- **Bluff** = a wrong answer at 80% or more, for both the reveal line and the recap count (coordinator; matches Discord). The reveal line uses the API's `biggest_bluff` and is left out when there is none, it is under 80%, or its choice is the right answer.
- **Most calibrated** = smallest |mean confidence − accuracy| among members with at least 3 revealed answers that week; ties: more answers, then more points. Left out when nobody has 3.
- **Streak** = the workspace's run of consecutive days, up to the Sunday, with at least one revealed answer (looks back at most 365 days).
- **Recap week** = Monday to Sunday before the recap's Monday. Posted at the post hour, before that day's question. A week with no answers is claimed and skipped.
- **rt_ms** = time from the A/B tap to the confidence tap (the picker carries the tap time). Not comparable with web timing; PREREG's response-time exclusions apply to the web only.
- **Revealed days only:** stats, recap and streak count only revealed (and so scored) days.
- **Open window:** answers are taken while the day is unrevealed, and only for today's or yesterday's question (the API's own rule; a 20:00 post is revealed at 04:00 the next day). After the reveal, A/B taps and leftover pickers are refused locally, without calling the API (the API does not know each workspace's reveal hour).
- **The day's post:** `/howsure` in the chosen channel, or anywhere while no channel is chosen, becomes the day's post (the reveal edits it; the cron skips the day). A second `/howsure` in the day's post's channel says the question is already up instead of posting twice. Elsewhere it posts a copy whose answers count the same; copies are not edited at the reveal. `/howsure` after the day's reveal posts nothing.
- **Question text** = "{prompt without the question mark}: {a} or {b}?", unless the prompt already names both options (the contract does not say which form `prompt` takes).
- **Values:** a unit containing "year" prints without thousands separators or unit (1903); other values as "6,650 km". Sources print when the reveal carries them.
- **Failures:** a failed reveal or recap releases its claim and is retried at the next hourly run; `/howsure reveal` also retries. The confidence picker is kept on an outage so the member can tap again.
- **Confidence picker** labels: "50% · coin flip", 60%, 70%, 80%, 90%, "100% · stake it all" (the brief names only the two ends).

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
