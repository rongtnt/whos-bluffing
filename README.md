# HowSure — How sure are you?

Free tools that show people how overconfident they are, and an open study built on the anonymous answers.

Three surfaces, one item bank, one question: do people know what they know?

| Surface | What it is | Folder |
|---|---|---|
| Daily game + full assessment (web) | Five numbers a day: give a range you are 90% sure contains the answer, see the truth and your share grid, keep a streak. The 5-minute full assessment, global comparison, share card and classroom mode for instructors live at `/test`. English only. | `web/` |
| Slack app | Install once per workspace: the day's game is posted to a channel with a Play button and a team leaderboard. | `slack/` |
| Anki add-on | In the flashcard app Anki, press 1–5 before each answer to say how sure you are; the add-on shows you where your confidence is wrong. Local by default. | `anki/` |

- Questions: `items/items.json` (hand-checked bank for the full assessment) and `items/pool.json` (2,074 numeric items generated from Wikidata with a source link each; `daily/schedule.json` says which five air on which day; `npm run tomorrow` in `web/` prints tomorrow's five for the nightly review).
- Pre-registered hypotheses: `prereg/PREREG.md`. Privacy: `PRIVACY.md`. Design docs: `docs/`.
- Metrics are defined once in `analysis/test_vectors.json`; the JavaScript and Python implementations must both pass it.

Independent, unaffiliated project. Anonymous, opt-in data. No accounts, no tracking, no ads.

Prior art, gratefully acknowledged: [AnkiCalibrateAddon](https://github.com/JulHeg/AnkiCalibrateAddon) (JulHeg, MIT) for the idea of rating confidence before an Anki answer; Clearer Thinking / Open Philanthropy's *Calibrate Your Judgment* for calibration training.

License: MIT.
