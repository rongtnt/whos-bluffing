# HowSure — How sure are you?

Free tools that show people how overconfident they are, and an open study built on the anonymous answers.

Two surfaces, one item bank, one question: do people know what they know?

| Surface | What it is | Folder |
|---|---|---|
| Web test | 5-minute test in English and Chinese: pick an answer and say how sure you are; give ranges you are 90% sure about. Results, global comparison, share card, classroom mode for instructors. | `web/` |
| Anki add-on | In the flashcard app Anki, press 1–5 before each answer to say how sure you are; the add-on shows you where your confidence is wrong. Local by default. | `anki/` |

- Questions: `items/` (single source of truth for both surfaces; every item has a source; see `items/REVIEW.md`).
- Pre-registered hypotheses: `prereg/PREREG.md`. Privacy: `PRIVACY.md`. Design docs: `docs/`.
- Metrics are defined once in `analysis/test_vectors.json`; the JavaScript and Python implementations must both pass it.

Independent, unaffiliated project. Anonymous, opt-in data. No accounts, no tracking, no ads.

Prior art, gratefully acknowledged: [AnkiCalibrateAddon](https://github.com/JulHeg/AnkiCalibrateAddon) (JulHeg, MIT) for the idea of rating confidence before an Anki answer; Clearer Thinking / Open Philanthropy's *Calibrate Your Judgment* for calibration training.

License: MIT.
