# Who's Bluffing? for Anki

Before Anki shows the answer, press **1–5** to say how sure you are. One keypress records the rating and reveals the answer, so studying takes no extra time. A dashboard then shows where your confidence is wrong: the cards you feel sure about but keep forgetting.

**This is desktop Anki only; AnkiDroid/iOS cannot run add-ons.** Built for Anki 26.09.x.

中文简介在最后。

## Install

- From a file: Anki → Tools → Add-ons → *Install from file…* → choose `whosbluffing.ankiaddon` → restart Anki.
- Build that file yourself: `bash anki/scripts/build.sh` → `anki/dist/whosbluffing.ankiaddon`.

## Use

1. Review as usual. On the **question** side a bar appears at the bottom: `Not sure 1 2 3 4 5 Certain`.
2. Press a number key (or click a button): 1 = not sure, 5 = certain. The answer appears at once.
3. Grade the card the way you always do. On the answer side every key does what Anki normally does (1–4 grade the card, 5 pauses audio).

Notes:
- On the question side, key 5 rates instead of pausing audio. Press 5 on the answer side to pause, or change the keys in the settings.
- On cards where you type the answer, the number keys type into the box while it has focus; click a button to rate.
- Space / Show Answer still reveals the answer without a rating. Those answers are only counted, not recorded.

## Dashboard

Tools → **Who's Bluffing: my calibration**:

- **Reliability diagram**: for each rating 1–5, how often you actually remembered (bar) next to how sure that rating means (dashed line), with counts.
- **By deck**: number of ratings, mean rating, recall rate, overconfidence.
- **Last 30 days**: daily recall rate vs. daily confidence.
- **Export CSV** (all rows) and **Open data folder**.

How the numbers are defined (also in the dialog footnote):

- Ratings 1, 2, 3, 4, 5 map to confidence **0.5, 0.625, 0.75, 0.875, 1.0** (50%–100%).
- Remembered = Hard, Good or Easy (ease ≥ 2). Again = forgot.
- Overconfidence = mapped confidence − recall rate. Above zero means more sure than right.

## Privacy: what is stored

Ratings live in `user_files/whosbluffing.sqlite` inside the add-on folder (Open data folder shows it). Export or delete it at any time. Deleting the add-on deletes this folder, so export first if you want to keep your data.

One row per rated answer: time (UTC), salted hashes of the card, deck and note type ids (a random salt made on your computer, never shared), your rating 1–5, your grade 1–4, time on the question and on the answer (ms), and the card's scheduling state when you rated it: interval, reviews, lapses, days since the last review, FSRS stability / difficulty / retrievability when available, Anki and add-on versions. **Card content is never stored.**

Nothing leaves your computer unless you turn on sharing (below). See `../PRIVACY.md`.

## Sharing anonymous data (optional, off by default)

Tools → **Who's Bluffing: share anonymous data…** opens a consent page. Nothing is sent before you press **Accept**; **Not now** changes nothing. If you turn it on, the add-on sends (word for word from `PRIVACY.md`): a random installation id, hashed card and deck identifiers (never card text), your rating, the grade you gave, response times, the scheduled interval, days since last review, FSRS memory state when available, interface language, add-on and Anki versions.

- In practice each uploaded row has: its local number (1, 2, 3, … so an interrupted upload can resume), the card and deck hashes, rating, grade, the two response times, interval, days since last review, FSRS stability / difficulty / retrievability, Anki and add-on versions. The review time, note type, review and lapse counts are **not** sent (PRIVACY.md does not list them); interface language is not sent either (the server has no field for it yet).
- Never sent: card text, names, emails, Anki's card ids, the salt. The installation id is the salt hashed again.
- Ratings you made before accepting are included, from every Anki profile on this computer (the add-on keeps one database for all profiles). Uploads run in the background right after you accept, when a profile opens and every 6 hours, 500 ratings per request. If the server cannot be reached, the same ratings are sent next time.
- The dashboard shows a status line, e.g. `Sharing on · 1,240 ratings uploaded · last 2 h ago`, with **Stop sharing** and **Delete my data**. Delete my data removes everything stored under your installation id on the server, turns sharing off and tells you how many ratings were deleted. If you turn sharing on again after a deletion, a new installation id is used (after Stop sharing, the same one).
- If the server reports that this installation's data was deleted, the add-on turns sharing off and says so once.
- **Before removing the add-on, press Delete my data** if you want the shared copy gone: removing the add-on deletes `user_files`, and with it the installation id needed to find your data.

## Settings

Tools → Add-ons → Who's Bluffing → Config (documented in the config dialog):

| key | default | meaning |
|---|---|---|
| `language` | `"auto"` | `"auto"` follows Anki's language; `"en"` or `"zh"` forces one |
| `reveal_on_rate` | `true` | `false` = a rating only records; reveal the answer yourself |
| `show_buttons` | `true` | `false` = keys only, no bar |
| `keys` | `["1","2","3","4","5"]` | keys for ratings 1–5 (question side only) |
| `share_data` | `false` | anonymous sharing; turned on by Accept on the consent page (setting it here alone sends nothing) |
| `api_base` | `"https://whosbluffing.com"` | server that receives shared data |
| `consent_version`, `consent_at` | `""` | filled in when you accept |

## Public calibration deck

`anki/scripts/make_deck.py` builds two decks from the two-alternative items in `items/items.json`: `WhosBluffing-Calibration-Deck-en.apkg` and `WhosBluffing-Calibration-Deck-zh.apkg` (same facts, one deck per language). Each card shows a question and two options (A/B); the back shows the correct option and its source.

To study it with the add-on installed:

1. File → Import → choose the `.apkg` for your language.
2. Study the deck. On each question, pick A or B in your head, then press 1–5 for how sure you are of that pick. 1 means a coin flip (50%), 5 means certain (100%).
3. On the answer side, grade **Again** if your pick was wrong, **Good** if it was right.
4. Open Tools → Who's Bluffing: my calibration. The *Who's Bluffing? Calibration Deck* row in the by-deck table is your calibration on general-knowledge questions. Because confidence 50%–100% matches a two-choice question exactly, the reliability diagram reads directly: a perfectly calibrated learner is right 75% of the time on cards rated 3.

Re-importing a newer version of the deck updates the notes instead of duplicating them (fixed note type, deck ids and note GUIDs).

## Development

```bash
uv venv anki/.venv --python 3.13                      # Python that Anki 26.09 ships
uv run --project anki pytest anki/tests               # syncs the dev group (aqt, anki, pytest, genanki), runs tests
bash anki/scripts/build.sh                            # -> anki/dist/whosbluffing.ankiaddon
uv run --project anki python anki/scripts/make_deck.py   # -> anki/dist/*.apkg
```

Runtime needs only the Python standard library plus the `aqt`/`anki` bundled with Anki. `store.py`, `metrics.py` and `i18n.py` are pure stdlib; `metrics.py` passes every case in `analysis/test_vectors.json`. `upload.py` is the only module with network code (stdlib `urllib`, always on a background thread); `sharing.py` holds the consent page, timers and dashboard buttons. Manual GUI checks: `TESTING.md`. Implementation notes and versions: `NOTES.md`.

## Credits

Prior art, gratefully acknowledged: [AnkiCalibrateAddon](https://github.com/JulHeg/AnkiCalibrateAddon) by JulHeg (MIT), which first asked for a confidence rating before an Anki answer. Who's Bluffing was written from scratch: one keypress both rates and reveals the answer, plus the dashboard and the bilingual interface.

Licence: all rights reserved (see the repository LICENSE); published for transparency and research verification only.

## 中文简介

在 Anki 翻开答案之前，按 **1–5** 说出你有多大把握（1 = 没把握，5 = 很有把握）。一次按键同时记录评分并翻开答案，不增加复习时间。答案面的按键保持 Anki 原样（1–4 评分）。

- 菜单 工具 → **Who's Bluffing：我的校准**：可靠性图、按牌组统计、最近 30 天趋势、导出 CSV。评分 1–5 换算为把握 50%、62.5%、75%、87.5%、100%；记住 = 困难、良好或简单（ease ≥ 2）；过度自信 = 换算把握 − 记住率。
- **仅桌面版 Anki**；AnkiDroid / iOS 不能运行插件。
- 评分保存在本机，永不记录卡片内容。v0.2 起可自愿分享匿名数据，默认关闭：工具 → **Who's Bluffing：分享匿名数据…**，看完同意页点"同意"才会上传；面板上有"停止分享"和"删除我的数据"。
- 公共题库：导入 `WhosBluffing-Calibration-Deck-zh.apkg`，每题先在心里选 A 或 B，再按 1–5 说出把握；选错按"重来"，选对按"良好"。
