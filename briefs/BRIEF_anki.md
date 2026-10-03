# Builder brief — HowSure for Anki v0.1

You are the executor. Build exactly this; smallest sensible fix for anything impossible, recorded in `anki/NOTES.md`.

Hard rules: no git commits. No network code of any kind in v0.1. No runtime dependencies beyond the Python stdlib and `aqt`/`anki`. Do not write to Anki's collection schema. Edit only `anki/` (read `items/` and `analysis/`). Do not invent questions: the public deck script reads `../items/items.json`; if it does not exist yet (another builder is drafting it in parallel), read `../items/schema.json` and make the script tolerate a missing or empty bank. No GUI runs; headless tests only.

## Goal
Anki desktop add-on for Anki 26.09.x: on the **question** side, keys 1–5 (and five on-screen buttons) record "how sure are you?" and reveal the answer in one keypress. Everything local. A dashboard shows the learner their calibration. Bilingual en/zh. Credits prior art.

## Pinned stack
`uv venv anki/.venv --python <X>` where X is the Python the latest `aqt` wheel on PyPI supports (check, do not assume; record versions in `anki/NOTES.md`). `uv pip install aqt anki pytest genanki` (genanki and pytest are dev-only). Tests run with `uv run --project anki pytest anki/tests` or an equivalent documented command.

## Files
```
anki/src/howsure/__init__.py   registers hooks + Tools menu entry
anki/src/howsure/manifest.json package "howsure", name "HowSure — How sure are you?"
anki/src/howsure/config.json config.md
anki/src/howsure/hooks.py store.py metrics.py dashboard.py i18n.py
anki/src/howsure/web/howsure.js howsure.css   injected into the reviewer
anki/README.md CHANGELOG.md TESTING.md NOTES.md
anki/scripts/build.sh      → dist/howsure.ankiaddon (zip of src/howsure contents; exclude __pycache__ and user_files; manifest.json at zip top level)
anki/scripts/make_deck.py  → dist/HowSure-Calibration-Deck-en.apkg and -zh.apkg
anki/tests/test_metrics.py test_store.py test_i18n.py test_import.py test_make_deck.py
anki/pyproject.toml (dev only)
```

## Behaviour
- `gui_hooks.reviewer_did_show_question`: inject a bar at the bottom of the card: five buttons labelled 1–5 with end labels "Not sure" / "Certain" (zh: 没把握 / 很有把握). The JS listens for keys 1–5 **only while the question side is shown** and calls `pycmd("howsure:jol:<n>")`. Verify that Anki's own 1–4 answer-ease shortcuts (answer side) are untouched.
- `gui_hooks.webview_did_receive_js_message`: on `howsure:jol:n` store a pending rating for the current card with `q_rt_ms` = now − question-shown time; then reveal the answer through the reviewer's show-answer method (find the exact current name in the installed `aqt`; record it in NOTES.md). If config `reveal_on_rate` is false, only record.
- `gui_hooks.reviewer_did_answer_card(reviewer, card, ease)`: if a pending rating exists for this card, insert one row: `ts` (ISO UTC), `card_hash` = sha256(card id + per-install random salt), `deck_hash`, `notetype_hash`, `jol` 1–5, `ease` 1–4, `q_rt_ms`, `a_rt_ms`, `ivl_days` (card.ivl), `reps`, `lapses`, `days_since_last_review` (from the revlog; null if none), `stability`, `difficulty` (card.memory_state when present, else null), `retrievability` (via the collection API when available, else null), `anki_version`, `addon_version`. **Never store card content.** Answers given without a rating only increment a counter.
- Storage: SQLite at `user_files/howsure.sqlite` (WAL, one table `ratings`, one table `meta` holding salt and counters). Pure-stdlib `store.py` so it is testable without Anki.
- Config (Anki add-on config, documented in `config.md`): `language: "auto"|"en"|"zh"`, `reveal_on_rate: true`, `show_buttons: true`, `keys: ["1","2","3","4","5"]`.
- Tools → "HowSure: my calibration": a dialog using `AnkiWebView` with HTML + inline SVG and no external assets: (a) reliability diagram — rating 1–5 vs recall rate (ease ≥ 2) with counts; (b) per-deck table — n, mean rating, recall rate, overconfidence = mapped confidence − recall rate, where mapped confidence maps ratings 1..5 → 0.5, 0.625, 0.75, 0.875, 1.0 (state this mapping in the dialog footnote and README); (c) last-30-days trend; (d) buttons: Export CSV (all rows), Open data folder. Dialog language follows config.
- v0.1 has **no** upload or sharing. README says opt-in sharing with a consent page arrives in v0.2.

## Metrics
`metrics.py` must pass every case in `../analysis/test_vectors.json` (conf as probability; auroc ties 0.5, null on one class; inclusive intervals). Keep it dependency-free so the analysis code can import it later.

## Public deck script
`make_deck.py` builds two `.apkg` files from the two-alternative items in `../items/items.json`: front = prompt + the two options, back = the correct option + source; tags `howsure::public`, `howsure::<id>`; deterministic model and deck ids; one deck per language. Document in README how a learner can study the public deck with the add-on installed.

## Acceptance (run all before reporting)
1. Tests green: metrics vectors; store insert/query/export round-trip; en/zh key parity; import smoke (`import howsure.hooks` succeeds with `aqt` importable, without starting Qt — stub `aqt.mw` if needed); deck build produces two `.apkg` with the right note count (or a clear skip when the bank is absent).
2. `bash anki/scripts/build.sh` → `dist/howsure.ankiaddon`; `unzip -l` shows `manifest.json` at the top level.
3. `grep -rniE "http|urllib|requests|socket" anki/src` → nothing.
4. `anki/TESTING.md`: GUI checklist for the user (install from file, review 10 cards pressing 1–5, confirm answer-side keys unchanged, open dashboard, export CSV, uninstall).
5. `anki/README.md` credits JulHeg/AnkiCalibrateAddon (MIT) as prior art and states "desktop Anki only; AnkiDroid/iOS cannot run add-ons".

## Report back (≤ 25 lines)
What exists, verbatim pytest summary, Python/aqt versions used, the reviewer method names you relied on, deviations, open questions for the user.
