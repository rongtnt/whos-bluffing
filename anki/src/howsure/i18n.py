"""English / Chinese UI strings. Pure stdlib. Both languages must have the same keys."""

# What sharing sends, verbatim from PRIVACY.md's "Anki add-on" section (a test compares the two). Both consent texts
# show it in English; change PRIVACY.md, this line, upload.SHARED_COLUMNS and upload.CONSENT_VERSION together.
SHARED_FIELDS = ("a random installation id, hashed card and deck identifiers (never card text), your rating, "
                 "the grade you gave, response times, the scheduled interval, days since last review, "
                 "FSRS memory state when available, interface language, add-on and Anki versions")

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
                    "more sure than right. Your ratings stay on this computer unless you turn on sharing.",
        "export": "Export CSV",
        "open_folder": "Open data folder",
        "exported": "Exported {n} rows.",
        "share_menu": "HowSure: share anonymous data…",
        "consent_title": "HowSure — share anonymous data",
        "consent_body": "Your ratings can help a public study of how well people judge what they will remember. "
                        "Nothing is sent until you press Accept, and you can stop at any time.\n\n"
                        "If you turn it on, the add-on sends: {fields}.\n\n"
                        "It never sends the text of your cards, your name or email, or Anki's own card ids. "
                        "Ratings you have already made are included. Each rating is numbered (1, 2, 3, …) so an "
                        "interrupted upload can resume. Uploads happen right after you accept, when you open your profile "
                        "and every 6 hours. "
                        "It covers the ratings of every Anki profile on this computer. The data becomes part of a "
                        "public anonymous research dataset.\n\n"
                        "\"Delete my data\" on the HowSure dashboard (Tools → HowSure: my calibration) removes "
                        "everything stored under your installation id. If you remove the add-on, press it first: "
                        "removing the add-on also removes the installation id needed to find your data.",
        "accept": "Accept",
        "not_now": "Not now",
        "status_on": "Sharing on · {n} ratings uploaded · last {ago}",
        "status_on_none": "Sharing on · nothing uploaded yet",
        "status_off": "Sharing off",
        "status_off_uploaded": "Sharing off · {n} ratings uploaded earlier",
        "just_now": "just now",
        "min_ago": "{n} min ago",
        "h_ago": "{n} h ago",
        "d_ago": "{n} d ago",
        "stop_sharing": "Stop sharing",
        "delete_data": "Delete my data",
        "delete_confirm": "Delete every rating this add-on has shared from the HowSure server? Sharing will be "
                          "turned off. The ratings on this computer stay.",
        "deleted": "Deleted {n} ratings from the HowSure server. Sharing is off.",
        "delete_failed": "Could not reach the HowSure server, so nothing was deleted yet. Sharing is off. "
                         "Please try Delete my data again later.",
        "share_gone": "The HowSure server says the data from this computer was deleted, so sharing is now off. "
                      "You can turn it on again from Tools → HowSure: share anonymous data….",
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
                    "除非你打开分享，评分只保存在本机。",
        "export": "导出 CSV",
        "open_folder": "打开数据文件夹",
        "exported": "已导出 {n} 行。",
        "share_menu": "HowSure：分享匿名数据…",
        "consent_title": "HowSure — 分享匿名数据",
        "consent_body": "你的评分可以帮助一项公开研究：人们判断自己能否记住时有多准。"
                        "按“同意”之前不会发送任何数据，你也可以随时停止。\n\n"
                        "打开后，插件会发送：一个随机的安装 ID、卡片和牌组的哈希标识（从不发送卡片文字）、你的评分、"
                        "你按的等级、反应时间、计划间隔、距上次复习的天数、FSRS 记忆状态（如有）、界面语言、"
                        "插件和 Anki 版本。\n\n"
                        "英文原文：If you turn it on, the add-on sends: {fields}.\n\n"
                        "插件从不发送卡片文字、你的姓名或邮箱，也不发送 Anki 自己的卡片 ID。已经做过的评分也会包括在内。"
                        "每条评分带一个序号（1、2、3……），上传中断后可以接着传。同意后马上上传，之后在打开用户配置时和每 6 小时上传一次。"
                        "这包括这台电脑上所有 Anki 用户配置的评分。数据会成为公开的匿名研究数据集的一部分。\n\n"
                        "HowSure 面板（工具 → HowSure：我的校准）上的“删除我的数据”会删除你的安装 ID 下保存的全部数据。"
                        "如果要卸载插件，请先点它：卸载会同时删掉用来找到这些数据的安装 ID。",
        "accept": "同意",
        "not_now": "以后再说",
        "status_on": "分享已开启 · 已上传 {n} 条评分 · 上次 {ago}",
        "status_on_none": "分享已开启 · 还没有上传",
        "status_off": "分享已关闭",
        "status_off_uploaded": "分享已关闭 · 之前已上传 {n} 条评分",
        "just_now": "刚刚",
        "min_ago": "{n} 分钟前",
        "h_ago": "{n} 小时前",
        "d_ago": "{n} 天前",
        "stop_sharing": "停止分享",
        "delete_data": "删除我的数据",
        "delete_confirm": "从 HowSure 服务器删除这个插件分享过的全部评分？分享会关闭。本机上的评分保留。",
        "deleted": "已从 HowSure 服务器删除 {n} 条评分。分享已关闭。",
        "delete_failed": "连不上 HowSure 服务器，还没有删除任何数据。分享已关闭。请稍后再点一次“删除我的数据”。",
        "share_gone": "HowSure 服务器表示这台电脑分享的数据已被删除，所以分享已关闭。"
                      "可以从 工具 → HowSure：分享匿名数据… 重新打开。",
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
