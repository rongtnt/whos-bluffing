# Implementation notes (v0.1)

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
