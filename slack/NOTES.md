# Builder notes: HowSure for Slack v0.2

v0.2 replaces the v0.1 modal game (Play button, 5-range modal, day board, `/api/daily` client) with one in-channel question a day, a private confidence picker, a reveal, a Monday recap and `/howsure reveal`.

## Brief vs contract: the contract (`docs/api-rounds.md`) was followed

1. **round_id.** The brief says `slack-{date}`; the contract says the id comes from `GET /api/round/daily-question?date=` (`dq-<date>`). The Worker never builds it: the post's buttons carry the returned `round_id` and `item_id`. The date is always passed, because the response has no date field.
2. **community.** The brief says "team hash"; the contract says `slack:<team hash>`. Sent as `slack:` + `sha256(team_id:SALT)`.
3. **Revisions.** The contract says a later answer before the reveal replaces the earlier one when the body has `revision: true`. Sent only on a change of mind (a stored answer exists); a first answer carries no `revision`. The contract gives no status for a refused answer, so any 4xx except 429 counts as refused: "You're already locked in: B at 80%." for a change, "This question is closed." for a first answer. 5xx, 429 and timeouts show "taking a break" and keep the picker.

## Deviations from the brief

1. **Stored beyond the brief's list**, each needed for a behaviour the brief asks for, none personal:
   - `answers.correct` (from the API response): the recap's accuracy per confidence level. At 50% the points are 0 whether right or wrong, so points alone cannot tell.
   - `posts.channel_id`: the reveal edits the post where it is, even if setup moves the channel later that day.
   - `installs.recap_week` (a Monday date): the recap posts once per week, also when that day's question was posted by hand.
   - `installs.roast`, `posts.revealed`: asked for by the brief.
2. **Reveal time** = max(post hour, the hour the day's post actually went up) + 8 h. Same as the brief's "post_hour + reveal_delay" for every scheduled post; a late post (set up after the hour) gets the full 8 h instead of minutes. One function (`game.revealAt`) feeds the post, the "Locked in" reply and the cron. The post time is the Slack message `ts` (epoch seconds), so nothing extra is stored.
3. **Reveal delay is a constant (8 h).** The brief says "default 8 h" but gives no command to change it.
4. **Roast off also leaves members with ≤ 0 points out of the named points list** (reveal and `/howsure stats`). Otherwise roast-off would still name people next to a loss. Roast on shows the plain top 5 / top 10.
5. **Bluff line:** "Someone was 90% sure it was B (the Danube). It wasn't." The brief's "the Nile is shorter" needs the opposite of the prompt's comparative, which the contract does not provide.
6. **Buttons read "A · the Nile" and "B · the Danube"** (brief: A / B), so nobody has to map letters to names. The letters still drive "Locked in: B at 80%" and "% A · % B".
7. **Sources in the reveal:** the contract's reveal response has values but no sources. The reveal shows `a_source` / `b_source` when the reveal response carries them, and leaves them out otherwise. They are not stored from the answer response (storage rule). Open question 1.
8. **Migration `0002_daily_question.sql` is additive** (ALTERs plus `answers`), so it applies whether or not 0001 was ever applied. The v0.1 table `scores` stays, unused; drop it with a later migration if wanted. Not dropped here: unrequested destructive DDL.
9. **Not built:** `/howsure play` (full rounds in chat). The contract and PREREG mention it; the Slack brief does not list it.

## Definitions the brief left open

- **anon_id** = `sha256(team_id:user_id:SALT)` hex (unchanged from v0.1).
- **Bluff** (recap count) = a wrong answer at 80% or more. The reveal's biggest bluff comes from the API; its line is left out when the API sends none or the bluff is at 50%.
- **Most calibrated** = smallest |mean confidence − accuracy| among members with at least 3 revealed answers that week; ties: more answers, then more points. Left out when nobody has 3.
- **Streak** = the workspace's run of consecutive days, up to the Sunday, with at least one revealed answer (looks back at most 365 days).
- **Recap week** = Monday to Sunday before the recap's Monday. Posted at the post hour, before that day's question. A week with no answers is claimed and skipped.
- **rt_ms** = time from the A/B tap to the confidence tap (the picker carries the tap time). Not comparable with web timing; PREREG's response-time exclusions apply to the web only.
- **Revealed days only:** stats, recap and streak count only revealed days. Before the reveal, points would give the answer away (the answer response carries `correct`, `truth` and `points`; none of it is shown before the reveal).
- **Open window:** answers are taken while the day is unrevealed, and only for today's or yesterday's question (a 20:00 post is revealed at 04:00 the next day). After the reveal, A/B taps and leftover pickers are refused locally, without calling the API.
- **The day's post:** `/howsure` in the chosen channel, or anywhere while no channel is chosen, becomes the day's post (the reveal edits it; the cron skips the day). A second `/howsure` in the day's post's channel says the question is already up instead of posting twice. Elsewhere it posts a copy whose answers count the same; copies are not edited at the reveal. `/howsure` after the day's reveal posts nothing.
- **Question text** = "{prompt without the question mark}: {a} or {b}?", unless the prompt already names both options (the contract does not say which form `prompt` takes).
- **Values:** a unit containing "year" prints without thousands separators or unit (1903); other values as "6,650 km".
- **Failures:** a failed reveal or recap releases its claim and is retried at the next hourly run (reveals until the day after the question's day); `/howsure reveal` also retries. The confidence picker is kept on an outage so the member can tap again.
- **Confidence picker** labels: "50% · coin flip", 60%, 70%, 80%, 90%, "100% · stake it all" (the brief names only the two ends).

## Acceptance (re-runnable)

```bash
cd slack
npm test
npx wrangler deploy --dry-run --outdir dist
grep -rn "console.log(" src    # expect no output
```

## Verified and not verified

- Verified: 38 tests with mocked Slack and a mocked rounds API that follows the contract exactly (the default reveal mock has no sources), against both migrations on SQLite. Wrangler 4.147.0 dry-run bundle (32.8 KiB). Mutation check: 25 deliberate bugs each turned a test red (no `slack:` prefix; a second `/howsure` posting twice; no salt; revision always / never; reveal, recap or post claimed twice; any of the three claims never released; unrevealed days in stats; roast off looking up the bluffer or naming losses; answers after the reveal; late-post reveal time; points leaked in "Locked in"; a refused answer treated as an outage; roast-only setup touching the channel; bluff threshold; the 3-answer rule for most calibrated; recap on any weekday; streak ignoring gaps; prompt not composed; no signature check).
- Fixed on the way: name lookup crashed when `conversations.members` answered ok without a `members` list (v0.1 code).
- Not verified: real Slack (no login allowed) and the real rounds API (`web/functions` has no `/api/round/*` yet). Block Kit layouts, ephemeral replacement through `response_url` (`replace_original: true` on the picker) and the button `text` echoed in `block_actions` payloads follow Slack's documentation as known to the builder and were not tried live.

## Open questions

1. **Reveal sources** (contract owner): add `a_source` and `b_source` to `GET /api/round/reveal`. The Worker already shows them when present.
2. **Refused revision status** (contract owner): which status does `/api/round/answer` return for a revision it will not take? Handled as any 4xx except 429.
3. **Day D on D+1** (contract owner): with a post hour of 16 or later, `dq-D` is answered until the reveal on D+1 UTC, and that reveal runs on D+1. The API must accept answers to `dq-D` on D+1, and `daily-question?date=D` and `reveal?date=D` must still answer on D+1; otherwise those workspaces' answers fail and their reveals retry hourly until abandoned at the end of D+1.
4. **Which reveal closes revisions?** Each workspace reveals at its own hour. The Worker refuses answers after its own reveal; whether the API also locks a community after its first `/api/round/reveal` call is up to the web side.
5. **PRIVACY.md** (outside slack/): the Slack paragraph says "per-day scores keyed by a salted hash". It should say per-day answers (A or B, confidence, whether right, points) keyed by a salted hash of the member id, plus the roast setting per workspace.
