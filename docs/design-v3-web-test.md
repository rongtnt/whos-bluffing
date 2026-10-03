# 旗舰活动设计 v3：HowSure（暂名）— 5 分钟双语"你有多过度自信"测试 + 公开研究

设计日期 2026-10-03（第三版，替代 v2 的 Anki 插件方案；v2 文件保留作备选）。
要求：impact 更大、拿到更容易、CS / cognitive science 两套口径、没有导师、招生官看得懂。
截止：Michigan 2/1；Vanderbilt、USC 2/15；CMU 2/16；MIT、Brown、JHU、Columbia、UChicago 3/1（MIT 待核）；Stanford、Penn、Cornell、Duke、HMC 3/15。**数字 1 月 25 日第一次冻结。**

---

## 0. 一句话

**一个免费网页：5 分钟、英文或中文，测出你有多过度自信（经典两种题型：二选一打信心分 + 给 90% 置信区间），当场给你结果、全球对比和一张可分享的卡片。老师可以开一个课堂码，上课时实时看全班的曲线。所有答案（匿名）汇成公开数据集，用来检验三条预注册假设，其中一条只有双语的人能便宜地做：人在第二语言里是不是没那么过度自信。**

### 为什么比 v2（Anki 插件）impact 更大、更容易

| | v2 Anki 插件 | v3 5 分钟网页测试 |
|---|---|---|
| 用户要做什么 | 下载桌面插件 | 点一个链接 |
| 一次传播带来 | 几十人 | 几千人（零门槛 + 结果可晒） |
| 招生官一眼懂的数字 | "N 个学生用我的插件" | "N 人、K 个国家做过；I 所大学课堂在用" |
| 天花板 | 1–5 千用户 | 10 万–100 万人 |
| 保底渠道 | 论坛帖子 | 课堂模式：一个老师 = 每学期 30–300 人，年年用 |
| 每人数据深度 | 上千条（纵向） | 20 条（横截面）→ 用双语 within-subject 设计补新颖性 |
| 构建 | 2 周 + 跟 Anki 每次升级 | 1–1.5 周，静态站 + 一个小后端 |
| 科学问题 | JOL vs 间隔、JOL vs FSRS | 过度自信跨语言/跨文化 + 外语效应 |

同样成立的理由：和你的主线"measure human judgment against reality"是同一句话；预测市场、Metaculus 式 calibration 是你讲得出来的背景。

### 先行者（已查）
Clearer Thinking / Open Philanthropy 的 "Calibrate Your Judgment"：英文、训练工具、题库几千、追踪个人进步。英国一次 2,000 人民调（81% 过度自信）。实验室文献：Yates 等人的跨文化过度自信、双语语言启动研究、EGO 范式跨文化研究。**没有**：5 分钟可晒结果、中英双语、within-subject 外语效应、课堂实时模式、预注册 + 开放数据。差异点成立；**仍不写 "first" / "largest"**，只写 "[N] people in [K] countries"。

---

## 1. 产品（core，第 1–2 周交付）

### 1.1 测试
- 20 题 ≈ 5 分钟：12 道二选一（答完给 50–100% 信心）+ 6 道数字区间（给一个你 90% 确定包含真值的范围）+ 2 道注意力检查。从题库随机抽，晒了也不泄题。
- 结果页：你的 calibration 曲线、"你的 90% 区间只有 x% 包含真值"、过度自信分数、全球百分位、按语言/地区的对比。
- 分享卡：浏览器本地生成 PNG，方形（小红书/微信）+ 横版（X），中英文各一版，带链接和二维码。**这张卡是增长引擎。**
- 双语：界面、题目、结果全部 EN / 中文。自认双语的人可以用另一种语言再做一组对应题（顺序随机）→ H3 的数据。
- 可选人口学（全部可跳过）：年龄段、教育程度、母语、常住地区。

### 1.2 课堂模式（v1 就带，不是以后）
- 老师建一个课堂码（无需注册，拿到一个私密仪表盘链接）→ 学生输入码做题 → 仪表盘实时显示人数、全班 calibration 曲线、区间命中率、过度自信分布；一键导出 CSV。
- 心理学导论、统计、经济、决策课本来就在课上做这个演示（文献里用 clicker 做）。给他们一个免费网页版。
- 推广成本：r/Professors 一帖 + 一段可转发的介绍 + 知乎/高校教师群（可选）。
- 隐私规则：仪表盘只显示全班聚合，永不显示单人记录；人数 < 5 时不显示任何图（小班可识别到人，这是"匿名"唯一会破的地方）。

### 1.3 题库（你亲自校对，3–4 小时）
- 每种语言 40 道二选一 + 20 道区间题，中英平行翻译，你自己回译核对。
- 领域平衡：物理常数、生物、地理（各大洲均匀）、历史年份（各地区均匀）、数学。**避开只有某国课本才教的内容。**
- 上线后每种语言样本 ≥ 2,000 时做 DIF（题目在两种语言间的差异功能）筛查，被标记的题在 H2 分析里"含/不含"各报一遍。

### 1.4 技术
- Cloudflare Pages（静态前端）+ Workers + D1（免费额度：每天 10 万请求 / 10 万次写 ≈ 每天 5 千份完成卷；超了 5 美元/月）。首页上 HN 不会挂。
- 不存 IP；国家来自 Cloudflare 请求头，只存国家码。无账号、无 cookie 追踪。
- 给 Opus 的实现注：每份完成卷存一行 JSON（不是每题一行），免费层的 10 万次写/天就对应约 10 万份完成卷，不是 5 千份。
- 域名约 10 美元/年。无广告、无打赏（F1）。
- 开源：GitHub 第一天建，commit 全在你名下。

---

## 2. Impact ladder（自己会涨、可核验）

| 级 | 数字 | 来源 | 时间 | 保底 / 乐观（1 月 25 日） |
|---|---|---|---|---|
| R0 | 上线 | 链接 | 第 2 周 | 已上线 |
| R1 | 参与人数、国家数 | 后端计数，公开实时页 | 第 3 周起 | 5,000 人 / 30 万人；30 / 120 国 |
| R2 | 答案条数 | 同上 | 同上 | 10 万 / 600 万 |
| R3 | 课堂采用 | 课堂码数、学校数 | 第 3 周起 | 10 位老师 / 150 位 |
| R4 | 语言数 | GitHub 翻译 PR（每多一种语言 = 多一个人群） | 第 5 周起 | 2 / 6 |
| R5 | 公开数据集 | OSF + Hugging Face + Kaggle 下载 | 第 10 周 | 100 / 3,000 |
| R6 | 三条预注册结果 + 预印本 | 仓库预注册 + PsyArXiv | 第 10–14 周 | 1 篇；CogSci 2027 摘要已投 |
| R7 | 第二波流量 | 结果本身可晒（r/dataisbeautiful、知乎热榜） | 第 13 周 | — |

保底怎么来：4 个帖子（HN、r/samplesize、小红书、知乎）各带 ~1,000 人 + 课堂模式。乐观怎么来：测试类内容在小红书/知乎天然易爆，一次热榜就是 10 万级。

---

## 3. 研究设计（分析前公开预注册，仓库里带日期的 `PREREG.md`）

**H1 过度自信在大样本重现，且难题更甚。** 二选一：平均信心 − 正确率 > 0；区间题：90% 区间命中率明显低于 90%。指标：过度自信分数、Brier、命中率、按题目难度分桶。
**H2 测试语言 / 地区差异。** 中文界面 vs 英文界面参与者的过度自信差异（Yates 系列）。控制：IRT 估题目难度、DIF 筛查、被标记题"含/不含"各报一遍、常住地区作协变量。措辞只说 "language of the test"，不把语言等同文化。
**H3 外语效应（within-subject，新东西）。** 双语参与者在第二语言里是否更不过度自信（Keysar, Hayakawa & An 2012 的外语效应延伸到 calibration）。顺序随机、题组匹配。验收标准（事先定）：差异的 95% CI 不含 0，且最小关心效应 2 个百分点。null 照报。
探索性（标注清楚）：年龄、教育；题型差异（二选一 vs 区间，Klayman 等 1999）；开源模型做同一批题的人机对比（本地跑，0 成本；申请文本里只当配角）。

**数据质量规则（预注册）**：2 道注意力检查全对；单题作答 < 1.5 秒剔除；必须完成；蜜罐字段过滤机器人；同一浏览器重复作答只取第一次（本地随机 id，不做指纹）。

### 你必须读完并能讲的 8 篇（1 月前；写作前核引用）
Lichtenstein, Fischhoff & Phillips 1982；Alpert & Raiffa 1982；Klayman, Soll, González-Vallejo & Barlas 1999；Soll & Klayman 2004；Moore & Healy 2008；Gigerenzer, Hoffrage & Kleinbölting 1991；Yates, Lee & Shinotsuka 1996；Keysar, Hayakawa & An 2012。

---

## 4. 数据与伦理（没有导师，全靠自己）

- 匿名、无账号、无 PII、不存 IP。开头一句同意语："5 分钟，匿名，结果用于公开研究，随时可关页面退出。"
- `PRIVACY.md` 公开；发布数据时附数据卡（采集方式、样本偏差、不能用来做什么）。
- 口径：对外只说 "anonymous, opt-in data from my free test"。**不说** "human-subjects study"、"IRB-approved"。预印本的 ethics statement 如实：anonymous opt-in data, independent project, no institutional affiliation.
- 替代导师的把关：预注册进仓库（git 时间戳）；分析代码 + 数据全开源；方法贴到 r/samplesize、r/AcademicPsychology、知乎征求批评并记录修改；PsyArXiv 无需 endorsement；CogSci 2027 学生可独立投（投前核规则）。
- 写 "first/largest" 之前先做 Semantic Scholar 扫描：overconfidence × online × cross-cultural × bilingual。
- F1：免费、无广告、无收入。

---

## 5. 给招生官看的文本（全部大白话，字符数含实际数字已核：N=120,000、K=80、I=40）

规则同前：活动栏不出现 calibration、JOL、IRT、DIF、pre-registered；"overconfident"、"quiz/test"、"people in [K] countries" 不用翻译就懂；少用 "AI"；发前过 10 秒复述测试。

### 5.1 Common App 活动栏（≤150）

**CS 版 · 数据阶段**（141）
> Built a free 5-minute test (English/Chinese) that shows how overconfident you are; [N] people in [K] countries took it; code and data public.

**CS 版 · 带课堂采用**（144）
> Built a free 5-minute bilingual test that shows how overconfident you are: [N] people, [K] countries; used as a live class demo at [I] colleges.

**Cog sci 版 · 数据阶段（"most were overconfident" 在 H1 确认后用）**（147）
> Do people know what they know? [N] people in [K] countries took my free 5-minute test, in English or Chinese; most were overconfident. Data public.

**Cog sci 版 · H3 出结果后**（146；方向和数字以实际结果为准，null 则换成 H1/H2 的发现）
> [N] people in [K] countries took my free bilingual overconfidence test; people were [x]% less overconfident in their second language. Data public.

**11 月过渡版**（145）
> Built and launched a free 5-minute test that shows people how overconfident they are, in English and Chinese; [N] people in [K] countries so far.

职位（≤50）：`Creator, developer and researcher`（33）
机构（≤100）：`HowSure — free overconfidence test and open study (independent)`（63）

### 5.2 长版（~100 词）

**CS**
> Most people are overconfident: ask for a range you are 90% sure contains the right answer, and the truth lands inside it far less often than nine times in ten. I built HowSure, a free five-minute web test in English and Chinese that measures this, shows you your result against everyone else, and gives you a card to share. Instructors can create a class code and watch their class's confidence curve build live during a lecture. [N] people in [K] countries have taken it and [I] instructors use it. The site, the question bank and the anonymous dataset of [M] answers are all open.

**Cog sci**
> Do people know what they know? Lab studies say no: we are overconfident, most of all on hard questions, and the effect may differ across cultures and even across the languages we think in. To test this at scale I built a free five-minute test in English and Chinese and published my hypotheses before collecting any data. [N] people in [K] countries took it; bilingual participants took it in both languages. [Finding, e.g.: people were less overconfident in their second language.] Every question was checked for cultural bias before any comparison was made. Data, code and analysis are public.

### 5.3 面试一句话
> I built a free five-minute test that shows people how overconfident they are. [N] people in [K] countries took it, which let me test whether people are less overconfident in their second language.

### 5.4 Fit（按 9/28 名单 + HMC / CMU CS；essay 前核括号里的名字）

| 学校 / 专业 | 一句 fit |
|---|---|
| CMU SCS（CS）/ Dietrich | CMU 的 Social & Decision Sciences 就是 calibration 文献的发源地（Fischhoff）；SCS 口径讲 web 规模的实验基础设施 + HCII。 |
| Penn CAS COGS | Tetlock / Mellers 的 Good Judgment Project：判断的 calibration，直接接你的预测背景。 |
| Stanford SymSys | 判断与决策 + 语言：外语效应那条线。 |
| MIT 6-9 | 造工具、采人类数据、建模，一个项目三件事。 |
| Harvey Mudd CS | 做了一个很多人在用的东西，并且量化了它真的做了什么。 |
| Brown BDS / Michigan D&C / Duke Decision Sciences / UChicago | 过度自信是这些项目的核心课程内容。 |
| Columbia / JHU / USC / Vanderbilt CogSci | 通用口径：大样本 + 预注册 + 开放数据。 |
| Cornell CALS InfoSci | HCI + 数据：产品、管道、数据集。 |

---

## 6. 执行计划（Opus 建，你驱动；周次从 10 月 5 日起）

| 周 | 做什么 | 你的时间 |
|---|---|---|
| 1 | 测试核心 + 结果页 + 分享卡 + 同意语 + 数据库；题库初稿（Opus 起草，**你校对 60 题**）；预注册草稿 | 6–8 h |
| 2 | 课堂模式 + 仪表盘；双语打磨；压测；PRIVACY.md + 数据卡草稿；预注册公开；小范围试用 ~50 人并修 | 5 h |
| 3 | 上线：Show HN、r/samplesize、r/psychology、X/Bluesky 学术圈；小红书（带分享卡）、知乎回答"人为什么过度自信"+链接、微博、B 站 60 秒；r/Professors 课堂推广帖 | 6 h（帖子你写） |
| 4–8 | 迭代；志愿者翻译 PR；公开实时统计页；每种语言 ≥2,000 时做 DIF；老师跟进 | 3–4 h/周 |
| 9–12 | N ≥ 5,000 时做 H1–H3 分析；数据发布（OSF + HF + Kaggle）；预印本 v1 + 中英博客；人机对比页 | 5 h/周（看懂每个数字） |
| 13–16 | 结果帖（r/dataisbeautiful、知乎）引第二波；写作 v2；CogSci 2027 摘要（核截止）；**1 月 25 日冻结**；过 10 秒测试 | 4 h/周 |
| 17+ | 每批提交前刷新数字 | 1 h/周 |

总计：你约 60–80 小时 / 4 个月（比 v2 少）；Opus 约 1.5 周建设 + 1 周分析。

---

## 7. 所有权（面试要过）

- 能解释两种题型为什么都要（二选一 = 经典度量；区间 = 可晒的那句话）。
- 能定义过度自信分数、Brier、命中率、hard–easy effect，解释 DIF 为什么必须做。
- 能复述 H1–H3 和验收标准，说清 H3 为什么只有双语的人能便宜地做。
- 能说局限：自选样本、横截面、语言 ≠ 文化、网络人群偏年轻高学历。
- Commit 历史在你名下、跨数月。

---

## 8. 风险与对策

| 风险 | 对策 |
|---|---|
| 不爆 | 保底 = 4 个帖子 + 课堂模式；结果出来后还有第二波 |
| 题目偏向某一文化 | 领域平衡 + DIF 筛查 + 含/不含各报一遍 |
| "就是个小测验" | 预注册 + 开放数据 + H3 的 within-subject 设计 |
| 数据脏 | 注意力检查、时间下限、蜜罐、重复过滤，全部预注册 |
| 上线当天挂 | Cloudflare 免费层扛得住首页流量 |
| 误写 first/largest | 文献扫描先行 |
| 翻译质量 | 你回译 + 一位双语朋友通读（可选） |

---

## 9. 需要你定的 3 件事

1. 用 v3（网页测试）替代 v2（Anki 插件）？v2 可留作以后的纵向追踪 rung。
2. 名字：HowSure 沿用（"How sure are you?"）或换。
3. 中文渠道：小红书 / 知乎 / 微博 / B 站 第 3 周同步发？

定了 Opus 第 1 周交 v0.1。
