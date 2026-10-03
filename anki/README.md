# HowSure for Anki — How sure are you?

Before Anki shows the answer, press **1–5** to say how sure you are. One keypress records the rating and reveals the answer, so studying takes no extra time. A dashboard then shows where your confidence is wrong: the cards you feel sure about but keep forgetting.

**This is desktop Anki only; AnkiDroid/iOS cannot run add-ons.** Built for Anki 26.09.x.

中文简介在最后。

## Install

- From a file: Anki → Tools → Add-ons → *Install from file…* → choose `howsure.ankiaddon` → restart Anki.
- Build that file yourself: `bash anki/scripts/build.sh` → `anki/dist/howsure.ankiaddon`.

## Use

1. Review as usual. On the **question** side a bar appears at the bottom: `Not sure 1 2 3 4 5 Certain`.
2. Press a number key (or click a button): 1 = not sure, 5 = certain. The answer appears at once.
3. Grade the card the way you always do. On the answer side every key does what Anki normally does (1–4 grade the card, 5 pauses audio).

Notes:
- On the question side, key 5 rates instead of pausing audio. Press 5 on the answer side to pause, or change the keys in the settings.
- On cards where you type the answer, the number keys type into the box while it has focus; click a button to rate.
- Space / Show Answer still reveals the answer without a rating. Those answers are only counted, not recorded.

## Dashboard

Tools → **HowSure: my calibration**:

- **Reliability diagram**: for each rating 1–5, how often you actually remembered (bar) next to how sure that rating means (dashed line), with counts.
- **By deck**: number of ratings, mean rating, recall rate, overconfidence.
- **Last 30 days**: daily recall rate vs. daily confidence.
- **Export CSV** (all rows) and **Open data folder**.

How the numbers are defined (also in the dialog footnote):

- Ratings 1, 2, 3, 4, 5 map to confidence **0.5, 0.625, 0.75, 0.875, 1.0** (50%–100%).
- Remembered = Hard, Good or Easy (ease ≥ 2). Again = forgot.
- Overconfidence = mapped confidence − recall rate. Above zero means more sure than right.

## Privacy: what is stored

v0.1 is **local only**. Nothing is uploaded or shared; the add-on contains no network code. Ratings live in `user_files/howsure.sqlite` inside the add-on folder (Open data folder shows it). Export or delete it at any time. Deleting the add-on deletes this folder, so export first if you want to keep your data.

One row per rated answer: time (UTC), salted hashes of the card, deck and note type ids (a random salt made on your computer, never shared), your rating 1–5, your grade 1–4, time on the question and on the answer (ms), and the card's scheduling state when you rated it: interval, reviews, lapses, days since the last review, FSRS stability / difficulty / retrievability when available, Anki and add-on versions. **Card content is never stored.**

Opt-in sharing with a consent page arrives in v0.2. It stays off unless you turn it on. See `../PRIVACY.md`.

## Settings

Tools → Add-ons → HowSure → Config (documented in the config dialog):

| key | default | meaning |
|---|---|---|
| `language` | `"auto"` | `"auto"` follows Anki's language; `"en"` or `"zh"` forces one |
| `reveal_on_rate` | `true` | `false` = a rating only records; reveal the answer yourself |
| `show_buttons` | `true` | `false` = keys only, no bar |
| `keys` | `["1","2","3","4","5"]` | keys for ratings 1–5 (question side only) |

## Public calibration deck

`anki/scripts/make_deck.py` builds two decks from the two-alternative items in `items/items.json`: `HowSure-Calibration-Deck-en.apkg` and `HowSure-Calibration-Deck-zh.apkg` (same facts, one deck per language). Each card shows a question and two options (A/B); the back shows the correct option and its source.

To study it with the add-on installed:

1. File → Import → choose the `.apkg` for your language.
2. Study the deck. On each question, pick A or B in your head, then press 1–5 for how sure you are of that pick. 1 means a coin flip (50%), 5 means certain (100%).
3. On the answer side, grade **Again** if your pick was wrong, **Good** if it was right.
4. Open Tools → HowSure: my calibration. The *HowSure Calibration Deck* row in the by-deck table is your calibration on general-knowledge questions. Because confidence 50%–100% matches a two-choice question exactly, the reliability diagram reads directly: a perfectly calibrated learner is right 75% of the time on cards rated 3.

Re-importing a newer version of the deck updates the notes instead of duplicating them (fixed note type, deck ids and note GUIDs).

## Development

```bash
uv venv anki/.venv --python 3.13                      # Python that Anki 26.09 ships
uv run --project anki pytest anki/tests               # syncs the dev group (aqt, anki, pytest, genanki), runs tests
bash anki/scripts/build.sh                            # -> anki/dist/howsure.ankiaddon
uv run --project anki python anki/scripts/make_deck.py   # -> anki/dist/*.apkg
```

Runtime needs only the Python standard library plus the `aqt`/`anki` bundled with Anki. `store.py`, `metrics.py` and `i18n.py` are pure stdlib; `metrics.py` passes every case in `analysis/test_vectors.json`. Manual GUI checks: `TESTING.md`. Implementation notes and versions: `NOTES.md`.

## Credits

Prior art, gratefully acknowledged: [AnkiCalibrateAddon](https://github.com/JulHeg/AnkiCalibrateAddon) by JulHeg (MIT), which first asked for a confidence rating before an Anki answer. HowSure was written from scratch: one keypress both rates and reveals the answer, plus the dashboard and the bilingual interface.

License: MIT.

## 中文简介

在 Anki 翻开答案之前，按 **1–5** 说出你有多大把握（1 = 没把握，5 = 很有把握）。一次按键同时记录评分并翻开答案，不增加复习时间。答案面的按键保持 Anki 原样（1–4 评分）。

- 菜单 工具 → **HowSure：我的校准**：可靠性图、按牌组统计、最近 30 天趋势、导出 CSV。评分 1–5 换算为把握 50%、62.5%、75%、87.5%、100%；记住 = 困难、良好或简单（ease ≥ 2）；过度自信 = 换算把握 − 记住率。
- **仅桌面版 Anki**；AnkiDroid / iOS 不能运行插件。
- v0.1 数据只保存在本机，永不记录卡片内容。v0.2 起提供带同意页的自愿分享，默认关闭。
- 公共题库：导入 `HowSure-Calibration-Deck-zh.apkg`，每题先在心里选 A 或 B，再按 1–5 说出把握；选错按"重来"，选对按"良好"。
