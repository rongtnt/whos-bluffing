# Testing

## Automated (headless, run by the builder)

```bash
uv run --project anki pytest anki/tests
bash anki/scripts/build.sh && unzip -l anki/dist/howsure.ankiaddon   # manifest.json at the top level
grep -rniE "http|urllib|requests|socket" anki/src                    # must print nothing
```

What pytest covers, with no Qt event loop and no window:

- `metrics.py` against every case in `analysis/test_vectors.json`, plus the dashboard summaries.
- `store.py`: insert / query / CSV export round trip, counter, salt persistence, WAL, rejected bad rows.
- en/zh string key and placeholder parity.
- `import howsure` with a stubbed `aqt.mw`: all six hooks and the Tools menu entry register.
- Key binding logic: on the answer side keys 1–4 and 5 call Anki's own handlers; on the question side they rate.
- Full rate → reveal → grade flow against a real temporary Anki collection (with an FSRS review): one row with the expected fields, no card text in the database file, unrated answers only counted.
- Dashboard HTML render; deck build from a sample bank and from the real `items/items.json` (skips if the bank is absent).

**Not verifiable headlessly, so please check by hand:** that the bar actually renders in the reviewer, that real key presses in the running app reach the add-on, that the answer is revealed, the dashboard dialog itself (export dialog, open folder), installing the `.ankiaddon` file, dark mode, and type-in-answer cards.

## Manual GUI checklist (Anki 26.09.x desktop)

Use a profile you do not mind adding test reviews to, or a copy of your collection.

1. **Install from file**
   - [ ] `bash anki/scripts/build.sh`, then Anki → Tools → Add-ons → *Install from file…* → `anki/dist/howsure.ankiaddon` → restart Anki.
   - [ ] The add-on list shows "HowSure — How sure are you?"; the Tools menu has "HowSure: my calibration".
2. **Review 10 cards pressing 1–5**
   - [ ] On the question side a bar shows `Not sure 1 2 3 4 5 Certain` at the bottom.
   - [ ] Pressing a number key reveals the answer immediately (one keypress), and the bar disappears.
   - [ ] Clicking a button does the same.
   - [ ] On a long card (scroll to the bottom), the bar does not cover the last line.
   - [ ] Do at least one card with Space / Show Answer and no rating (it should only be counted).
3. **Answer-side keys unchanged**
   - [ ] On the answer side, 1 / 2 / 3 / 4 grade Again / Hard / Good / Easy exactly as before.
   - [ ] On a card with audio, 5 on the answer side still pauses audio.
   - [ ] Space / Enter on the answer side behave as before.
   - [ ] On the question side, Space still shows the answer (without a rating).
4. **Type-in-answer card** (note type with `{{type:Back}}`)
   - [ ] With the cursor in the box, number keys type into the box and do not rate.
   - [ ] Clicking a rating button reveals the answer and the typed-answer comparison still appears.
5. **Open dashboard**: Tools → HowSure: my calibration
   - [ ] The summary counts match what you did in step 2 (rated vs. without a rating).
   - [ ] The reliability diagram shows bars with n per rating; the by-deck table shows your deck names; today's point is on the trend.
   - [ ] Switch Anki to the dark theme (Preferences) and reopen: text and charts are readable.
6. **Export CSV**
   - [ ] *Export CSV* → save → open the file: header with 17 columns, one row per rated answer, no card text.
   - [ ] *Open data folder* shows `howsure.sqlite`.
7. **Settings** (Tools → Add-ons → HowSure → Config)
   - [ ] `"language": "zh"` → the bar shows 没把握 / 很有把握 on the next question; the dashboard is in Chinese.
   - [ ] `"reveal_on_rate": false` → a number key highlights its button but does not reveal; Space reveals; after grading, the row has that rating.
   - [ ] `"show_buttons": false` → no bar; keys still rate.
   - [ ] An invalid value (e.g. `"language": "fr"`) is rejected by the config dialog.
8. **Uninstall**
   - [ ] Export first if you want to keep the data (deleting the add-on deletes its `user_files`).
   - [ ] Tools → Add-ons → select HowSure → Delete → restart. Reviewing works normally, the Tools entry is gone, and 1–5 on the question side do nothing again.
