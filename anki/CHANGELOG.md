# Changelog

## 0.1.0 — 2026-10-03

First version. Local only.

- Question side: keys 1–5 and five buttons ("Not sure" … "Certain") record how sure you are and reveal the answer in one step. Answer-side keys are unchanged.
- One local SQLite row per rated answer (`user_files/howsure.sqlite`): rating, grade, response times, the card's scheduling state at the time of rating (interval, reviews, lapses, days since last review, FSRS stability/difficulty/retrievability), salted id hashes. Never card content. Answers without a rating are only counted.
- Tools → "HowSure: my calibration": reliability diagram, per-deck table, last-30-days trend, Export CSV, Open data folder.
- English and Chinese interface (`language`: auto / en / zh).
- Settings: `language`, `reveal_on_rate`, `show_buttons`, `keys`.
- Script to build the public two-choice calibration deck (en, zh) from `items/items.json`.
