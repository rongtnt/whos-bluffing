# Builder brief — HowSure for Anki v0.2: opt-in anonymous data sharing

You are the executor. Repo /Users/ethan/howsure. Read first: anki/README.md, anki/NOTES.md, anki/src/howsure/*.py, PRIVACY.md (the "Anki add-on" section lists the exact fields you may send), prereg/PREREG.md (Study B), docs/design-v4-scale.md, web/README.md and web/NOTES.md (D1 conventions: bounded reads, aggregate tables), web/migrations/*.sql.

Hard rules: no git commands; no deploy/login/purchases. Edit only anki/ and, in web/, only new files plus the smallest additions to web/test/smoke.sh, web/README.md, web/NOTES.md and a new migration. Keep every existing test green (web 48+14 unit, 65 smoke; anki 31; slack 21). Add-on runtime = stdlib + aqt only; uploads use `urllib` in a background task, never on the UI thread. Sharing is OFF by default and nothing is sent before explicit consent. Never send card content, names, emails or raw card ids. Plain English copy; no mention of AI.

## Web side
- Migration `web/migrations/0004_anki.sql`: `anki_installs(install_id TEXT PRIMARY KEY, first_seen TEXT, last_seen TEXT, rows INTEGER, consent_version TEXT, deleted_at TEXT)`; `anki_rows(install_id TEXT, row_id INTEGER, ts TEXT, card_hash TEXT, deck_hash TEXT, notetype_hash TEXT, jol INTEGER, ease INTEGER, q_rt_ms INTEGER, a_rt_ms INTEGER, ivl_days REAL, reps INTEGER, lapses INTEGER, days_since_last_review REAL, stability REAL, difficulty REAL, retrievability REAL, anki_version TEXT, addon_version TEXT, PRIMARY KEY(install_id,row_id))`; `anki_agg(day TEXT PRIMARY KEY, installs INTEGER, rows INTEGER)` maintained on submit.
- `POST /api/anki/submit` body `{install_id (32–64 chars), addon_version, consent_version, rows:[...]}` (≤ 2,000 rows per request; each row validated: jol 1–5, ease 1–4, numeric fields finite or null, ts ISO). Upsert rows (idempotent on install_id,row_id), update anki_installs and anki_agg in one `env.DB.batch`. Response `{accepted, duplicates, total_rows_for_install}`. Reject with 410 if the install has `deleted_at` set (the add-on then stops sharing and tells the user).
- `POST /api/anki/delete` body `{install_id}` → deletes the install's rows, sets `deleted_at`, decrements aggregates; `{deleted_rows}`.
- `GET /api/anki/stats` → `{installs_30d, rows_total}` from `anki_agg` only (cache 60 s). Anki contributors are NOT part of MAU (PREREG counts plays); add `anki_contributors_30d` to the KPI output as a separate number and show it on `/stats` as its own line.
- Bounded reads: nothing scans `anki_rows` on a request path. Smoke: submit 3 rows twice (second call all duplicates), stats reflect it, delete removes them and a later submit returns 410.

## Add-on side
- Config: `share_data: false`, `api_base: "https://howsure.me"`, `consent_version` recorded on accept.
- Tools → "HowSure: share anonymous data…" opens a consent dialog whose field list is copied verbatim from PRIVACY.md's Anki section, with Accept / Not now. Accepting stores consent timestamp + version and turns sharing on. The dashboard gets a status line ("Sharing on · 1,240 ratings uploaded · last 2 h ago") with buttons: Stop sharing, Delete my data (calls `/api/anki/delete`, turns sharing off, confirms the count).
- Upload: on profile open and then every 6 hours (`QTimer`), in `mw.taskman.run_in_background`, send rows with `row_id > last_uploaded_row_id` in batches of 500; on success advance the cursor (stored in `meta`). Network errors are silent retries next time; a 410 turns sharing off with a one-time message. The install_id is the existing per-install salt hashed again (so the salt itself never leaves the machine).
- Tests (headless): payload builder respects the field whitelist and never includes card text or raw ids; cursor advances only on success (mock urlopen); no upload attempted when `share_data` is false; delete clears cursor and flips the flag; consent dialog text equals the PRIVACY.md field list (read the file in the test).
- Bump `addon_version` to 0.2.0; update README, CHANGELOG, TESTING (GUI steps for consent, upload, delete).

## Acceptance
`uv run --project anki pytest anki/tests` green; `bash anki/scripts/build.sh`; web `npm test` and `bash test/smoke.sh` green with the new smoke phase; `grep -rn "urllib" anki/src` shows use only in the upload module; `scripts/check.sh` green.

## Report back (≤ 20 lines)
What exists, verbatim test summaries, deviations, open questions.
