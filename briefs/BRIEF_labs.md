# BRIEF claim your lab (2026-10-05)

After an AI-pack round, a player can say which lab they are with; a public scoreboard shows how each lab's people
score and how overconfident they are. Self-reported, anonymous, nothing else stored. Purpose: every reply to an AI
leader can say "your side is losing", and reporters get a headline. The owner ordered it built now.

## Data (web/migrations/0008_labs.sql)
- `lab_claims(round_id TEXT PRIMARY KEY, lab TEXT NOT NULL, date TEXT NOT NULL, difficulty TEXT NOT NULL,
  score INTEGER NOT NULL, overconfidence REAL NOT NULL, created_at TEXT NOT NULL)` with an index on (lab, date).
- `lab_agg(lab, date, difficulty, players, sum_score, sum_overconf, PRIMARY KEY (lab, date, difficulty))` so reads are
  bounded (same idea as round_agg). A changed claim decrements the old lab's row and increments the new one.
- Labs: `openai`, `anthropic`, `google`, `xai`, `meta`, `other`. Display names: OpenAI, Anthropic, Google, xAI, Meta,
  Other.

## API (web/functions)
- `POST /api/round/lab` body `{round_id, anon_id, lab}` → `{ok, lab, board}`. Valid only when the round is a completed
  quick round in pack `ai` and this anon_id completed it (the plays row exists); otherwise 400/404. Upsert: a repeat
  with another lab moves the claim. Takes score and overconfidence from the stored play. Returns the board below.
- `GET /api/labs?range=all|30d` → `{as_of, range, min_players: 10, labs: [{lab, name, players, mean_score,
  mean_overconfidence}]}` sorted by mean_score descending among labs at or above `min_players`, then the rest by
  players; labs under 10 players carry `players` only (means null). Cached 60 s with caches.default like stats.js.
- Validate everything at the boundary (lab in the enum, ids well formed). Document both in docs/api-rounds.md.

## Web
- Round end (web/public/round-end.js and the minimal hook in rounds.js): for rounds with `pack === 'ai'`, under the
  type card, a block titled "Which lab are you with?" with six chips (OpenAI · Anthropic · Google · xAI · Meta · Other).
  One tap posts the claim, presses the chip, and renders the mini board: one row per lab (name, players, average score;
  "{k} more players needed" instead of means under 10), the player's lab highlighted. The choice is kept in
  localStorage (`whosbluffing_lab`); later AI rounds claim automatically and show "You're with {Lab} · change".
  Under the board, a link "Full board" to /labs. The share text gains one line when the player's lab has 10 or more
  players: "I'm with {Lab}. {Lab} averages {score} on the AI round." (keep shareWith's structure).
- New page `/labs` (web/public/labs.html + labs.js, shell copied from an existing simple page such as stats.html so
  the shared header and footer stay byte-identical to web/scripts/page.html): H1 "Which lab bluffs least?", one
  sentence "Self-reported: anyone who finishes an AI round can say which lab they're with; nothing else is stored.",
  a toggle All time · Last 30 days, the board as a table (lab, players, average score, "points more sure than right"
  for overconfidence in plain words), means hidden under 10 players, and a Play button linking
  `/?pack=ai&difficulty=brutal`. Meta tags like the other pages (title, description, canonical, OG).
- Styles appended at the END of web/public/styles.css under a `/* labs */` comment; nothing else in that file changes.
- Copy register: plain, correct English, no slang, no exclamation marks, no "calibrated"; types unchanged.

## Boundaries (another builder is rewriting the home page right now)
Do not touch web/public/index.html, home.js, picker.js, support.html, stats.html, stats.js or web/scripts/page.html, and
do not add the footer link (I will add it once). Work only in: web/migrations/0008_labs.sql, web/functions (new route
files and the smallest change in _rounds.js), web/public/round-end.js, rounds.js (hook only), labs.html, labs.js,
styles.css (appended block), web/test, web/scripts/smoke.sh, docs/api-rounds.md, PRIVACY.md (one paragraph under
Rounds: what a lab claim stores), web/NOTES.md (dated note at the end).

## Tests and acceptance
- Unit tests: claim validation (wrong pack, not completed, bad lab), aggregation math, a moved claim corrects both
  rows, means hidden under 10, board order. Smoke: both endpoints end to end on local D1 (the migration applies on a
  fresh database). Pages test passes for labs.html. `cd web && npm test` and `bash scripts/check.sh` green.
- Do not deploy, do not commit. Report in at most 12 lines: files, test counts, anything not done and why.
