# Rounds API contract (replaces the daily-item loop for the viral game; the full assessment at /test keeps intervals)

All JSON. Dates are UTC `YYYY-MM-DD`. `surface` ∈ {web, slack, room}. A **play** = one completed round (10 answered) on web/room, or one in-channel Slack answer.

- `GET /api/round?mode=ranked|quick&seen=<comma ids, ≤300>` → `{round_id, mode, date, items:[{id, prompt, a, b}]}` — 10 comparison pairs. Ranked: the day's fixed 10 from `daily/rounds.json` (same for everyone; only referenced or fact-checked items). Quick: random unseen pairs, difficulty mix by ratio. Never includes values or truth.
- `POST /api/round/answer` body `{round_id, item_id, choice:0|1, conf:50|60|70|80|90|100, rt_ms, anon_id, surface, community?}` → `{correct, truth:{a_value, b_value, unit, a_source, b_source}, points, total}` where `points = 100 − 400·(c − y)²` with c = conf/100, y = 1 if correct. Idempotent per (anon_id, round_id, item_id).
- `POST /api/round/complete` body `{round_id, anon_id, surface, community?, nickname?}` → `{score, accuracy, mean_conf, overconfidence, brier, type, streak, rank_today?, players_today?, challenge_url, share_text, roast?}`. Marks the play. `type` ∈ {Bluffer, Hot-headed, Calibrated, Modest, Hedger} from overconfidence = mean_conf − accuracy (≥ +15, +5..+15, −5..+5, −15..−5, ≤ −15 in percentage points).
- `GET /c/:round_id/:player` (Pages Function, HTML) — challenge page with per-link OG tags ("{nickname} scored {score}. Can you beat them?") that starts the same round; after completion shows the side-by-side via `GET /api/round/:round_id/compare?me=<anon_id>&them=<player>` → `{me:{...}, them:{nickname, score, accuracy, mean_conf, overconfidence, type}}`. `player` is a short public token minted at complete time, never the anon_id.
- `GET /api/round/stats?date=` → `{players, score_hist, mean_overconfidence}` for the ranked round (cache 60 s).
- `POST /api/event` body `{type: "share"|"challenge_view"|"play_again", anon_id?, round_id?}` → `{ok}`; anonymous counters only.
- Slack: `GET /api/round/daily-question?date=` → `{item_id, prompt, a, b}`; answers via `/api/round/answer` with surface=slack and community=team hash; `GET /api/round/reveal?date=&community=` → `{n, pct_a, pct_b, correct, biggest_bluff:{anon_id, conf, choice}}` (the Slack worker decides whether to name them: roast mode off → "someone was 95% sure…").
- `GET /api/kpi` adds `rounds_per_player_day`, `d1_return`, `d7_return`, `challenge_conversion` (completed rounds / challenge views), `share_rate` (share events / completed rounds), each for the trailing 30 days.

Daily-item endpoints (`/api/daily/*`) remain for the full assessment and existing data; the home page no longer uses them.
