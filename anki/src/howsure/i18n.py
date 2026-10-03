"""English / Chinese UI strings. Pure stdlib. Both languages must have the same keys."""

STRINGS = {
    "en": {
        "not_sure": "Not sure",
        "certain": "Certain",
        "bar_title": "How sure are you?",
        "key_hint": "Key {key}",
        "menu": "HowSure: my calibration",
        "dlg_title": "HowSure — my calibration",
        "empty": "No ratings yet. While reviewing, press 1–5 on the question side "
                 "(or click a button) to say how sure you are.",
        "summary": "{n} rated answers · {unrated} answers without a rating",
        "overall": "Overall overconfidence: {pp}",
        "reliability": "How sure you were vs. how often you remembered",
        "rating": "Rating",
        "recall": "Recall rate",
        "confidence": "Confidence",
        "by_deck": "By deck",
        "deck": "Deck",
        "count": "n",
        "mean_rating": "Mean rating",
        "overconfidence": "Overconfidence",
        "trend": "Last 30 days",
        "deleted_deck": "Deleted deck {h}",
        "pp": "{v} pp",
        "footnote": "Ratings 1–5 map to confidence 50%, 62.5%, 75%, 87.5%, 100%. "
                    "Remembered = Hard, Good or Easy (ease ≥ 2); Again = forgot. "
                    "Overconfidence = mapped confidence − recall rate; above zero means "
                    "more sure than right. All data stays on this computer.",
        "export": "Export CSV",
        "open_folder": "Open data folder",
        "exported": "Exported {n} rows.",
    },
    "zh": {
        "not_sure": "没把握",
        "certain": "很有把握",
        "bar_title": "你有多大把握？",
        "key_hint": "按键 {key}",
        "menu": "HowSure：我的校准",
        "dlg_title": "HowSure — 我的校准",
        "empty": "还没有评分。复习时在问题面按 1–5（或点按钮）说出你有多大把握。",
        "summary": "已评分 {n} 次 · 未评分作答 {unrated} 次",
        "overall": "整体过度自信：{pp}",
        "reliability": "把握程度 vs. 实际记住的比例",
        "rating": "评分",
        "recall": "记住率",
        "confidence": "把握（换算）",
        "by_deck": "按牌组",
        "deck": "牌组",
        "count": "次数",
        "mean_rating": "平均评分",
        "overconfidence": "过度自信",
        "trend": "最近 30 天",
        "deleted_deck": "已删除的牌组 {h}",
        "pp": "{v} 个百分点",
        "footnote": "评分 1–5 换算为把握 50%、62.5%、75%、87.5%、100%。"
                    "记住 = 困难、良好或简单（ease ≥ 2）；重来 = 忘了。"
                    "过度自信 = 换算把握 − 记住率；大于零表示把握高于实际。"
                    "所有数据只保存在本机。",
        "export": "导出 CSV",
        "open_folder": "打开数据文件夹",
        "exported": "已导出 {n} 行。",
    },
}


def resolve(setting: str, anki_lang: str | None) -> str:
    """Config "en"/"zh" wins; "auto" follows Anki's interface language."""
    if setting in STRINGS:
        return setting
    return "zh" if (anki_lang or "").lower().startswith("zh") else "en"


def t(lang: str, key: str, /, **fields: object) -> str:
    """Positional-only parameters, so a placeholder may itself be named "key" or "lang"."""
    return STRINGS[lang][key].format(**fields)
