**HowSure settings** (中文说明在下面)

- `language`: `"auto"` follows Anki's interface language; `"en"` or `"zh"` forces English or Chinese.
- `reveal_on_rate`: `true` = pressing 1–5 records your rating and shows the answer in one step. `false` = only record; show the answer yourself (Space / Show Answer).
- `show_buttons`: `true` = show the five rating buttons at the bottom of the question. `false` = keys only.
- `keys`: the five keys for ratings 1 (not sure) to 5 (certain). They act only on the question side; on the answer side every key does what Anki normally does (1–4 grade the card, 5 pauses audio). Key changes take effect the next time you start reviewing.
- `share_data`: anonymous data sharing, off by default. Turn it on with Tools → HowSure: share anonymous data… and Accept; setting it to `true` here without accepting sends nothing. The HowSure dashboard has Stop sharing and Delete my data.
- `api_base`: the server that receives shared data.
- `consent_version`, `consent_at`: filled in when you accept (which consent text, and when). Leave them alone.

Your ratings are stored on this computer, in the add-on's `user_files` folder, and are sent nowhere unless you turn on sharing.

---

- `language`：`"auto"` 跟随 Anki 界面语言；`"en"` 或 `"zh"` 强制英文或中文。
- `reveal_on_rate`：`true` = 按 1–5 记录把握并直接翻开答案；`false` = 只记录，答案自己翻（空格 / 显示答案）。
- `show_buttons`：`true` = 在问题面底部显示五个评分按钮；`false` = 只用按键。
- `keys`：评分 1（没把握）到 5（很有把握）对应的五个按键。只在问题面生效；答案面所有按键保持 Anki 原样（1–4 评分，5 暂停音频）。改按键后，下次开始复习时生效。
- `share_data`：匿名数据分享，默认关闭。用 工具 → HowSure：分享匿名数据… 并点"同意"来打开；只在这里改成 `true` 而不同意，不会发送任何数据。HowSure 面板上有"停止分享"和"删除我的数据"。
- `api_base`：接收分享数据的服务器。
- `consent_version`、`consent_at`：同意时自动填写（同意的是哪一版文字、什么时候）。不用改。

评分保存在本机插件的 `user_files` 文件夹；除非你打开分享，不会发送到任何地方。
