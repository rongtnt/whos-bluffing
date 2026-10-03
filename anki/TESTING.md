# Testing

## Automated (headless, run by the builder)

```bash
uv run --project anki pytest anki/tests
bash anki/scripts/build.sh && unzip -l anki/dist/howsure.ankiaddon   # manifest.json at the top level
grep -rliE "\b(http|urllib|requests|socket)\b" anki/src            # must print only anki/src/howsure/upload.py
```

What pytest covers, with no Qt event loop and no window:

- `metrics.py` against every case in `analysis/test_vectors.json`, plus the dashboard summaries.
- `store.py`: insert / query / CSV export round trip, counter, salt persistence, WAL, rejected bad rows.
- en/zh string key and placeholder parity.
- `import howsure` with a stubbed `aqt.mw`: all six hooks and the Tools menu entry register.
- Key binding logic: on the answer side keys 1–4 and 5 call Anki's own handlers; on the question side they rate.
- Full rate → reveal → grade flow against a real temporary Anki collection (with an FSRS review): one row with the expected fields, no card text in the database file, unrated answers only counted.
- Dashboard HTML render; deck build from a sample bank and from the real `items/items.json` (skips if the bank is absent).
- Sharing (`tests/test_sharing.py`, `urlopen` mocked, background tasks run inline): the consent text (en and zh) contains PRIVACY.md's field list word for word; the payload keeps only `row_id` + the whitelisted columns (no review time, note type, reviews, lapses, card text or card ids; the installation id is not the salt and matches the server's format); the cursor moves only after the server accepts a batch (offline, timeout and HTTP 500 leave it); no upload unless `share_data` is on **and** the current consent was accepted; profile open uploads and starts one 6-hour timer; a 410 turns sharing off with one message and the next Accept uses a new id; Delete my data asks first, turns sharing off, clears the cursor and reports the count (and keeps the data if the server cannot be reached); the status line text.

**Not verifiable headlessly, so please check by hand:** that the bar actually renders in the reviewer, that real key presses in the running app reach the add-on, that the answer is revealed, the dashboard dialog itself (export dialog, open folder), installing the `.ankiaddon` file, dark mode, and type-in-answer cards. For v0.2: the consent dialog and the dashboard's sharing line inside a running Anki, and a real upload from Anki to a server (the builder ran `upload.py` against a local `wrangler pages dev`, outside Anki; see `NOTES.md`).

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
   - [ ] Export first if you want to keep the data (deleting the add-on deletes its `user_files`). If sharing was ever on, press Delete my data first if you want the server copy gone (the installation id is lost with `user_files`).
   - [ ] Tools → Add-ons → select HowSure → Delete → restart. Reviewing works normally, the Tools entry is gone, and 1–5 on the question side do nothing again.
9. **Sharing (v0.2)** — needs a local server, because `https://howsure.me` is not deployed yet
   - [ ] Off by default: the Tools menu has "HowSure: share anonymous data…"; the dashboard's bottom line says "Sharing off" with no buttons.
   - [ ] Start the server: `cd web && npm install && npm run migrate:local && npm run dev` (http://127.0.0.1:8788). In the add-on config set `"api_base": "http://127.0.0.1:8788"`. Review a few cards with ratings, restart Anki: `curl -s http://localhost:8788/api/anki/stats` still shows `"installs_30d":0,"rows_total":0` (nothing is sent before consent).
   - [ ] Tools → HowSure: share anonymous data… The dialog lists what is sent (the sentence from `PRIVACY.md`) and has Accept / Not now; **Not now** is the default, so Enter or Escape does not turn sharing on. Press **Not now**: nothing changes.
   - [ ] Open it again and press **Accept**. Within a few seconds `curl -s http://127.0.0.1:8788/api/anki/stats` shows `installs_30d` 1 and `rows_total` equal to your rated answers (stats are cached 60 s per address; alternate between `127.0.0.1` and `localhost` for a fresh read). The config now shows `share_data: true`, `consent_version: "1"` and `consent_at`. The dashboard says "Sharing on · N ratings uploaded · last just now" with Stop sharing and Delete my data.
   - [ ] Server rows hold no card text: `cd web && npx wrangler d1 execute howsure --local --command "SELECT * FROM anki_rows LIMIT 3"` shows hashes and numbers only; `ts`, `notetype_hash`, `reps` and `lapses` are empty.
   - [ ] Rate 3 more cards, then switch profile (or restart Anki): the dashboard count grows by 3 (uploads run on profile open and every 6 hours).
   - [ ] Offline: stop the server, rate a card, switch profile: no error dialog, reviewing is unaffected. Start the server again and switch profile: the card arrives.
   - [ ] **Stop sharing**: the line says "Sharing off · N ratings uploaded earlier"; new ratings are not sent after a profile switch.
   - [ ] **Delete my data** → confirm → "Deleted N ratings from the HowSure server. Sharing is off." The stats show `rows_total` 0; the Delete button is gone. Accept again later: everything is uploaded again under a new installation id (`installs_30d` 1).
   - [ ] Server-side deletion: while sharing is on, run `npx wrangler d1 execute howsure --local --command "UPDATE anki_installs SET deleted_at = '2026-10-03T00:00:00Z'"`, rate a card and switch profile: one message says the data was deleted and sharing is off; switching profile again shows no second message.
   - [ ] Put `api_base` back to `https://howsure.me` (Restore Defaults also turns sharing off).
