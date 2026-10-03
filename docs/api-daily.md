# Daily API contract (web implements; Slack consumes)

Base: the web deployment (`https://<host>/api`). All JSON. Dates are UTC `YYYY-MM-DD`. `surface` ∈ {web, slack, classroom}.

- `GET /api/daily?date=YYYY-MM-DD` (date optional, default today UTC) → `{date, number, items:[{id, prompt, unit, accept:[lo,hi]}]}` — never includes answers.
- `POST /api/daily/answer` body `{date, item_id, low, high, anon_id, surface, rt_ms}` → `{hit, truth, source, log_ratio_error}`; idempotent per (anon_id, date, item_id): a second answer returns the first result.
- `POST /api/daily/complete` body `{date, anon_id, surface}` → `{hits, n, streak, share_text, today:{players, avg_hits, hist:[n0..n5]}}`. Marks the play complete (this is what MAU counts).
- `GET /api/daily/stats?date=` → `{players, avg_hits, hist:[n0..n5]}` (passed plays only, cache 60 s).
- `POST /api/flag` body `{item_id, anon_id, reason}` → `{ok}`; 3 distinct flags retire an item pending review.
- `GET /api/kpi` → `{as_of, mau, dau, mau_by_surface:{web, slack, classroom}, communities:{workspaces, classrooms}}` from the daily KPI job.

Anonymous ids: web = random id in localStorage; Slack = sha256(team_id + ":" + user_id + salt) computed in the Slack worker; never the raw Slack ids. Server stores `players(anon_id, surface, first_seen, last_seen, plays)` and `plays(anon_id, date, surface, hits, completed_at)`.
