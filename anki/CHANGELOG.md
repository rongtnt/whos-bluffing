# Changelog

## 0.2.0 — 2026-10-03

Opt-in anonymous data sharing. Off by default; nothing is sent before you accept.

- Name "Who's Bluffing? for Anki": package folder `whosbluffing`, ratings in `user_files/whosbluffing.sqlite` (2026-10-04).
- Tools → "Who's Bluffing: share anonymous data…": consent page (Accept / Not now) listing what is sent, word for word from PRIVACY.md.
- Uploads in the background (right after you accept, when a profile opens, every 6 hours), 500 ratings per request, resuming where the last successful request ended. Only the fields PRIVACY.md lists; never card text, names, emails or card ids.
- Dashboard: status line ("Sharing on · 1,240 ratings uploaded · last 2 h ago"), Stop sharing, Delete my data (removes everything stored under your installation id on the server and reports the count).
- New settings: `share_data`, `api_base`, `consent_version`, `consent_at`.

## 0.1.0 — 2026-10-03

First version. Local only.

- Question side: keys 1–5 and five buttons ("Not sure" … "Certain") record how sure you are and reveal the answer in one step. Answer-side keys are unchanged.
- One local SQLite row per rated answer (`user_files/whosbluffing.sqlite`): rating, grade, response times, the card's scheduling state at the time of rating (interval, reviews, lapses, days since last review, FSRS stability/difficulty/retrievability), salted id hashes. Never card content. Answers without a rating are only counted.
- Tools → "Who's Bluffing: my calibration": reliability diagram, per-deck table, last-30-days trend, Export CSV, Open data folder.
- English and Chinese interface (`language`: auto / en / zh).
- Settings: `language`, `reveal_on_rate`, `show_buttons`, `keys`.
- Script to build the public two-choice calibration deck (en, zh) from `items/items.json`.
