# Implementation notes

## v0.2 (2026-10-03): opt-in anonymous sharing

Brief: `briefs/BRIEF_anki_v02.md`. Files: `upload.py` (new, the only network code), `sharing.py` (new, the Qt side), small changes to `__init__.py`, `dashboard.py`, `hooks.py` (version), `i18n.py`, `store.py` (`get_meta`/`set_meta`), the config files and `manifest.json`. Server side: `web/functions/_anki.js` (see `web/NOTES.md`).

### Deviations and decisions

1. **What is sent follows PRIVACY.md, not the server's column list.** The brief's `anki_rows` table also has `ts`, `notetype_hash`, `reps` and `lapses`, but PRIVACY.md's Anki section (the field whitelist, quoted in the consent dialog) does not list a review time, note type, review count or lapse count. They are not sent; the server columns stay NULL. Each row is sent as `row_id` + `upload.SHARED_COLUMNS`: card and deck hashes, rating (`jol`), grade (`ease`), `q_rt_ms`, `a_rt_ms`, `ivl_days`, `days_since_last_review`, FSRS `stability`/`difficulty`/`retrievability`, `anki_version`, `addon_version`. `row_id` is the local row number (needed to resume and to make uploads idempotent); the consent text says ratings are numbered. Study B (PREREG) needs none of the four left out: its time-ordered split can use `row_id`. **Interface language** is in PRIVACY.md's list but has no server column, so it is not sent (the consent text over-states by that one item). To change any of this: edit PRIVACY.md, `i18n.SHARED_FIELDS`, `upload.SHARED_COLUMNS` and bump `upload.CONSENT_VERSION`; the server already accepts the four columns.
2. **Installation id** = `sha256("install-<generation>" + salt)` (`store.hash_id`), so the salt never leaves the computer. The server refuses a deleted id for good (410), so after Delete my data or a 410 the add-on marks the id deleted (`share_deleted` in `meta`) and the next Accept moves to generation + 1, a fresh id starting again at row 1. Without this, re-consenting after a deletion would be refused forever.
3. **Consent lives in the add-on config** (`share_data`, `consent_version`, `consent_at`, visible in the config editor). An upload needs `share_data == true` **and** `consent_version == upload.CONSENT_VERSION` ("1"), so switching `share_data` on in the config editor alone sends nothing, and a future consent text (new version) needs a new Accept.
4. **Upload loop** (`upload.upload_pending`): rows after the cursor (`upload_cursor` in `meta`), 500 per request; the cursor moves only after a 200. `OSError` (unreachable, timeouts, HTTP 4xx/5xx) and `ValueError` (bad JSON) end the run quietly with a line in Anki's debug console; the next run re-sends the same rows (the server de-duplicates). 410 → id forgotten, sharing off, one message (`share_gone`); since sharing is then off, the message cannot repeat. Runs: right after Accept, on `profile_did_open`, and every 6 hours (`mw.progress.timer`, a QTimer made once per session, `requiresCollection=False`: uploads read only the add-on's own database). Always `mw.taskman.run_in_background(..., uses_collection=False)`. Config is read on the main thread and passed in; Stop sharing, and `profile_will_close` (quit or profile switch), set a `threading.Event` checked before each batch, so a long first upload cannot keep Anki's process alive after quitting; saving the config editor with sharing off does the same (`setConfigUpdatedAction`). A lock keeps an upload and a delete from overlapping. If the id turns out to be deleted while sharing is on (Accept pressed before a running Delete finished), the upload reports it like a 410, so sharing goes off and the next Accept moves to a new id.
5. **Delete my data**: confirm → sharing off first → `POST /api/anki/delete` in the background → "Deleted N ratings…" (or a warning if the server cannot be reached; the button stays so the user can retry). Success clears the cursor and marks the id deleted (decision 2).
6. **Dashboard status line** ("Sharing on · 1,240 ratings uploaded · last 2 h ago") and the Stop sharing / Delete my data buttons are Qt widgets under the existing buttons, not part of the HTML (whose test asserts it contains no link). "Uploaded" = local rows up to the cursor under the current id. Stop sharing shows while sharing is on; Delete my data once consent was ever given, until the data is deleted.
7. **Consent dialog** is a `QMessageBox` with Accept / Not now; Not now is the default button, so Enter does not consent (Escape and closing the window also mean Not now). macOS ignores message-box window titles, so the title is also the bold main text and the consent text is the informative text. The Chinese dialog is a translation plus the English sentence from PRIVACY.md word for word (labelled 英文原文); a test checks both against the file.
8. **Existing tests touched:** the `pkg` fixture moved from `tests/test_import.py` to `tests/conftest.py` (session scope, so the new `tests/test_sharing.py` can use the same stubbed import), and its menu assertion now expects two Tools entries. No assertion was weakened.
9. **`scripts/check.sh` "anki: no network code" fails by design.** It greps `\b(http|urllib|requests|socket)\b` over `anki/src`, which v0.2 must match (`upload.py` uses urllib, as the brief requires). `scripts/` is outside this builder's folders. Every hit is in `upload.py` (checked); suggested replacement for that step: `grep -rliE "\b(http|urllib|requests|socket)\b" anki/src` must print exactly `anki/src/howsure/upload.py`. `TESTING.md` uses that rule.
10. **Default `api_base` is `https://howsure.me`**, which is not deployed yet. Until it is, uploads fail quietly and retry; nothing is lost (the cursor does not move).

### Headless probes (scratch scripts, not part of pytest)

- Offscreen Qt (`QT_QPA_PLATFORM=offscreen`): the consent `QMessageBox` shows the title, the consent text and Accept / Not now; Not now changes nothing; Accept records consent and starts an upload; the dashboard status row shows "Sharing on · nothing uploaded yet" with both buttons, and after Stop sharing "Sharing off" with only Delete my data.
- Real HTTP: `upload.py` (urllib) against a local `wrangler pages dev` with a fresh D1, rows made by the real rate → grade flow on a temporary collection: 7 rows in 3 requests; re-sending them stores no duplicates (`rows_total` 7); delete returns 7 and marks the id deleted; uploading with the deleted id gets 410; the next id uploads again. The server's `anki_rows` had `ts`, `notetype_hash` and `reps` NULL in every row and no card text.

Not verifiable here: the dialog and status row inside a running Anki, a real upload to the deployed site. Manual steps: `TESTING.md`.

Review: a code-review pass (read-only, with randomized submit/delete sequences against the SQL) found no critical or high issues; its low findings were fixed (Not now as the default button, the config-editor stop, the Accept-during-Delete case, Content-Length checked before reading the body, the uninstall and all-profiles notes).

### Known limits (v0.2)

- A batch whose response is lost is sent again next time; the server counts those rows as duplicates.
- Rows rated before consent are uploaded too (the consent text says so).
- "Uploaded" counts local rows up to the cursor; it is not read from the server.
- An upload running when Stop sharing is pressed finishes its current batch (at most 500 rows) first.
- Undo still leaves the earlier row (v0.1 limit); if it was uploaded, the server keeps it too.
- One database and one consent per Anki installation, not per profile: Accept shares the ratings of every profile on the computer (the consent text says so). Per-profile consent would need a profile column in the local table.
- Removing the add-on deletes `user_files` (salt, installation id, cursor), after which the user cannot delete their server rows; README and the consent text say to press Delete my data first.
- `row_id` and `consent_version` are sent but are not in PRIVACY.md's list (the consent text mentions the numbering).

---

# v0.1 notes

## Versions

| | version | source |
|---|---|---|
| Python (venv) | 3.13.14 | `uv venv anki/.venv --python 3.13`. The `aqt` 26.9.3 wheel declares `Requires-Python >=3.10`, and `anki` is a `cp310-abi3` wheel; Anki's own repo pins 3.13.13 (`.python-version` at tag 26.09.3), so 3.13 matches what Anki desktop ships. |
| aqt | 26.9.3 | latest on PyPI, 2026-10-03 |
| anki | 26.9.3 | `anki.buildinfo.version` = `26.09.3`, `int_version()` = 260903 |
| PyQt6 / Qt | 6.11.0 / 6.11.2 | pulled in by aqt (PyQt6-WebEngine 6.11.0) |
| genanki | 0.13.1 | dev only (deck script) |
| pytest | 9.1.1 | dev only |
| uv | 0.12.5 | `anki/uv.lock` pins the dev group |

Anki desktop is not installed on the build machine; everything was verified against the PyPI wheels.

## Anki surface this add-on relies on

Hooks (`aqt.gui_hooks`):
- `reviewer_did_show_question(card)`: start the question timer, clear any stale pending rating, show the bar.
- `reviewer_did_show_answer(card)`: start the answer timer, hide the bar. *(Not in the brief; needed for `a_rt_ms` when the answer is revealed by Space.)*
- `reviewer_did_answer_card(reviewer, card, ease)`: write the row, or bump the unrated counter.
- `webview_did_receive_js_message(handled, message, context)`: button clicks, `howsure:jol:<n>`.
- `state_shortcuts_will_change(state, shortcuts)`: rating keys (see deviation 1).
- `webview_will_set_content(web_content, context)`: add `web/howsure.js` + `howsure.css` to the reviewer page via `addonManager.setWebExports`.

Reviewer and collection:
- **Show-answer method:** `Reviewer._getTypedAnswer()`. It is what Anki's own Show Answer button (`pycmd("ans")` → `Reviewer._linkHandler`) and Space/Enter on the question side (`Reviewer.onEnterKey`) call. It reads the typed answer, then calls `Reviewer._showAnswer()`, the method that actually shows the answer. Both are underscore-private.
- `Reviewer.state` (`"question"` / `"answer"` / `"transition"`), `Reviewer.card`, `Reviewer.web.eval`, `mw.reviewer`, `mw.state == "review"` when the shortcut hook fires (`AnkiQt.moveToState` sets it before `Reviewer.show()` → `setStateShortcuts`).
- `card.ivl`, `card.reps`, `card.lapses`, `card.memory_state.stability/.difficulty` (None without FSRS), `card.current_deck_id()`, `card.note().mid`.
- `col.card_stats_data(cid).fsrs_retrievability` (behind `HasField`), `col.db.scalar(... revlog ...)`, `col.decks.all_names_and_ids()`.
- `mw.addonManager.getConfig / setWebExports / addonFromModule`, `mw.form.menuTools`, `AnkiWebView.stdHtml / cleanup`, `aqt.utils.getSaveFile / openFolder / tooltip`, `anki.lang.current_lang`.

## Deviations from the brief

1. **Keys 1–5 are bound in Python, not read in JavaScript.** In the review state Anki registers window-level Qt shortcuts for 1–4 (answer ease, via `pm.get_answer_key`) and 5 (pause audio). Qt consumes a key press that matches a shortcut before the web page sees it, so a JS `keydown` listener never receives 1–5. Headless probe (offscreen Qt, QWebEngineView + window QShortcuts on 1–5, `QTest.keyClick`): page focused → the Qt shortcuts fired for 1 and 5 and JS received only the unbound control key 8; text input focused → JS received 1 and no shortcut fired. Fix: `state_shortcuts_will_change` wraps each configured key. On the question side the wrapper rates; otherwise it calls the callable Anki had bound, so answer-side keys run Anki's original handlers unchanged (tested). Keys with no Anki binding (e.g. answer keys remapped) are added and do nothing outside the question side. The JS only draws the buttons and sends `pycmd("howsure:jol:<n>")`. Side effect: on the question side, 5 rates instead of pausing audio (documented in README and config.md).
2. **Reveal via `_getTypedAnswer()`, not `_showAnswer()` directly.** Calling `_showAnswer()` directly on a type-in-answer card would pass `typedAnswer=None` into `col.compare_answer`. `_getTypedAnswer()` is Anki's own Show Answer path and ends in `_showAnswer()`.
3. **Scheduling fields are snapshotted when the rating is given, not read in `reviewer_did_answer_card`.** `Reviewer._answerCard` → `after_answer` calls `self.card.load()` before firing that hook, so `card.ivl` and `card.memory_state` there already include the new grade, and retrievability is ~1.0 (verified on a temp collection: 1.0 right after a review). `ivl_days`, `reps`, `lapses`, `days_since_last_review`, `stability`, `difficulty` and `retrievability` therefore describe the card as it was when the learner judged it. `ts`, `ease` and `a_rt_ms` are taken at answer time.
4. `days_since_last_review` = (now − newest revlog id with `ease > 0`) in fractional days, clamped at ≥ 0. `ease > 0` skips manual reschedule rows. Null for a card with no earlier answer.
5. Hashes: `sha256(str(id) + salt)`, salt = 32 hex characters from `secrets`, stored in `meta`. The same function is used for the deck (the home deck: `card.current_deck_id()`, the original deck when the card sits in a filtered deck) and the note type (`note.mid`).
6. The dashboard shows deck names by hashing the local deck ids at display time. Names are never stored. Hashes with no current deck show as "Deleted deck <first 8 hex>".
7. Added `config.schema.json` (Anki's config editor validates against it, so bad values are rejected at entry) and `manifest.json` `min_point_version: 260900` (Anki refuses to install it on versions older than 26.09, which were never tested). No `homepage` in the manifest: the acceptance grep forbids "http" anywhere under `src/`.
8. One SQLite connection per operation, closed straight away. No handle stays open while Anki moves `user_files` during an add-on update (which would fail on Windows), and WAL is checkpointed on every close.
9. Timers: `q_rt_ms` = question shown → rating; `a_rt_ms` = answer shown → `reviewer_did_answer_card`, which includes the scheduler's background op (a few ms). `time.monotonic()`.
10. Repeat presses: with `reveal_on_rate` on, a second press while the answer is coming is ignored; with it off, the last press before the reveal wins.
11. `metrics.auroc` uses the rank-sum formula (O(n log n), average ranks for ties) instead of the pairwise loop in `analysis/metrics_reference.py`. It gives identical results on every vector and stays fast on 500k ratings.
12. Public deck: only `type == "2afc"` items (the two `attention` checks are web-test controls). One note type "HowSure two-choice" (id 1745312601), deck ids en 1745312611 / zh 1745312612, note GUID = `guid_for("howsure", id, lang)`, fields HTML-escaped, source shown as plain text. A malformed two-choice item raises an error naming its id. With the bank present on 2026-10-03, it builds 40 notes per language.
13. Tests: `tests/conftest.py` puts `src/howsure` on `sys.path`, so `store`/`metrics`/`i18n` import without running the package `__init__` (which needs a running Anki), and `src` for the package smoke test. `pyproject.toml` has a `dev` dependency group, so `uv run --project anki pytest anki/tests` reproduces the environment.

14. The bar's bottom padding uses CSS `body:has(> #howsure-bar:not([hidden]))`, not a body class: Anki's `_showQuestion` JS resets `document.body.className` on every question.

## Headless probes (scratch scripts, not part of pytest)

Both ran with `QT_QPA_PLATFORM=offscreen` (nothing displayed) against the venv's QtWebEngine 6.11:
- Key routing: see deviation 1.
- Bar: `web/howsure.js` + `howsure.css` in a QWebEngineView → 5 buttons, labels `Not sure 1 2 3 4 5 Certain`, `position: fixed; bottom: 0`; body padding 56px even after `body.className` is reset; clicking button 3 sends `pycmd("howsure:jol:3")`; `mark(3)` highlights it; `hide()` and `show_buttons: false` remove the bar and the padding; re-showing leaves one bar in the DOM.

This is the same engine Anki uses, but it is not the real reviewer page. Rendering inside Anki stays a manual check (`TESTING.md`).

## Known limits (v0.1)

- Undo after grading does not remove the row; grading the card again adds a second row for that card.
- `keys` changes apply the next time the review screen opens; the other settings apply from the next card.
- Deleting the add-on deletes `user_files` with the ratings (Anki's behaviour); README and TESTING say to export first.
- The Tools menu label is chosen at startup, so a `language` change shows there after a restart.
