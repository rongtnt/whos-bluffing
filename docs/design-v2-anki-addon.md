# 旗舰活动设计：HowSure（暂名）
## 把每天的 Anki 复习变成一场元记忆（metamemory）实验

设计日期 2026-10-03。目标：一个活动，两套口径（CS / cognitive science），描述随数据自己长大，执行成本低。

截止（你 9/28 名单 + 今日核实）：Michigan 2/1；Vanderbilt、USC 2/15；CMU 2/16（官网，材料 3/1）；MIT、Brown、JHU、Columbia、UChicago 3/1（MIT 另有 3/15 的说法，开申请时核）；Stanford、Penn、Cornell、Duke、Harvey Mudd 3/15。
**数字第一次冻结 1 月 25 日**，之后每批提交前刷新一次。

---

## 0. 一句话

**做一个开源 Anki 插件：每张卡片翻开答案之前，按一个键（1–5）说出"我有多大把握"。插件给学习者看自己的 calibration；经同意、去标识后，这些 judgments-of-learning（JOL）汇成公开数据集；用它检验三条预注册假设，其中一条直接挑战实验室结论，另一条测试 JOL 能否改进 Anki 内置的 FSRS 记忆模型。**

### 为什么是它（从第一性原理）

| 要求 | 这个活动怎么满足 |
|---|---|
| CS 和 cog sci 两边都能说 | 工程面：shipped software、数据管道、模型评测。认知面：metamemory / JOL 是教科书级范式（Nelson & Narens 1990）。同一组事实，两种描述，不用编。 |
| "写得大"但诚实 | 杠杆在**每个用户每天产生 100–300 个数据点**。50 个用户两个月 ≈ 50 万条判断。数字大是因为单位用户产出高，不是吹。 |
| "好搞" | 核心插件 ≈ 500 行 Python + 100 行 JS，Opus 两周内交付。之后数据自己涨，你每周 4–6 小时。 |
| 有现成分发渠道 | AnkiWeb 插件目录、r/Anki、Anki 论坛、知乎/B 站的 Anki 圈（中国 Anki 用户极多）。不用从零拉用户。 |
| 有真正的科学问题 | 实验室结论：人的 JOL 对间隔效应不敏感（Kornell & Bjork 2008；Logan, Castel, Haber & Viehman 2012）。没人在真实学习环境、大样本上测过。我们的数据正好能测。 |
| 和你本人连得上 | 你做过预测市场、Metaculus 式 calibration、模型评测。"知道自己知道什么"是你一贯的线，和你的主线 "I build systems that measure human judgment against reality" 是同一句话。面试讲得出来。 |
| 先行者弱 | 已有 Anki Calibrate（JulHeg，MIT 许可，2★，2024-08 后无更新；当前 Anki 已到 26.09，大概率失效）。它用滑块替换 Show Answer 按钮（多一步）。无数据集、无研究、无中文。README 里致谢它。 |
| 不是靠 "first" 撑 | 文献快查没发现大规模真实环境 JOL 数据集。**但先别写 "first"**，见 §4 的文献扫描任务。 |

---

## 1. 活动本体（core）

### 1.1 插件 HowSure（第 1–2 周交付）

- **交互**：问题面出现时，底部一行 5 个按钮 `1 2 3 4 5`（没把握 → 很有把握）。按数字键 = 记录 JOL **并翻开答案**。零额外步骤。这一个决定决定用户数。
- **记录**（本地 SQLite，不碰 Anki 的 collection，避免同步冲突）：card_id 哈希、deck 哈希、JOL（1–5）、随后打的等级（Again/Hard/Good/Easy = 1–4）、问题面停留毫秒、答案面停留毫秒、距上次复习天数、计划间隔、FSRS 的 stability / difficulty / 估算 retrievability、时间戳（ISO-8601 UTC）、UI 语言、插件版本、Anki 版本、匿名 install_id（UUID）。**永不记录卡片内容。**
- **Dashboard**（菜单里一个窗口）：reliability diagram（JOL 分桶 vs 实际正确率）、按 deck/tag 的过度自信排行、Brier、最近 30 天趋势。纯 HTML + 内联 SVG，无依赖。
- **双语 UI**：English / 中文。
- **限制**：仅桌面版（AnkiDroid / iOS 不支持插件）。写在 README 里。
- **开源**：GitHub 公开仓库，第一天就建，MIT 许可，commit 全在你名下、持续数月。
- 技术入口（给 Opus）：`gui_hooks.reviewer_did_show_question` 注入按钮和键盘监听 → `pycmd("howsure:3")` → `webview_did_receive_js_message` 落库并调用 reviewer 翻面；`reviewer_did_answer_card` 补写等级与调度字段；`card.memory_state` 取 FSRS 状态。目标 Anki 26.09.x。

### 1.2 数据贡献开关（与插件解耦，第 4–6 周打开）

- 默认关。打开前有完整同意页：列出每个字段、说明去标识、说明用途、给出"删除我的数据"按钮（按 install_id 删除）。
- 传输：每日批量 POST 到 Cloudflare Worker + D1（免费额度足够）。
- 公开实时统计页（GitHub Pages，每日自动更新）：贡献者数、判断总数、全体 reliability diagram。**这一页就是"自己长大的 impact"**，申请材料里放链接。
- **什么时候打开**：§4 的四样（同意页、删除按钮、PRIVACY.md、数据卡草稿）齐了就开，目标第 4 周。插件先发，开关后开。

### 1.3 公共双语 calibration deck（第 5–7 周）

- 150 对题 = 300 张卡（EN / 中文同一事实），常识类，原创或 CC0，由你亲自校对。
- 用途：(a) 吸引用户的"测测你有多自信"入口；(b) 人和模型回答**同一批题**，让 §3 的人机比较做到题目级对齐；(c) 中英文用户 calibration 的对照。

---

## 2. Impact ladder（"合理地越写越大"的机制）

每一级新增一个**自己会涨、可核验**的数字。AnkiWeb 不公开下载量，所以用户数一律用插件内 opt-in 计数（保守、可信），不编下载量。

| 级 | 产出 | 数字从哪来 | 时间 | 保守 / 乐观（1 月 25 日） |
|---|---|---|---|---|
| R0 | 插件上线 GitHub + AnkiWeb | 链接 | 第 2 周 | 已发布 |
| R1 | 用户 | opt-in 贡献者数、GitHub stars、AnkiWeb 评分数 | 第 3–8 周 | 60 / 800 贡献者；50 / 500 ★ |
| R2 | 判断条数 | Worker 聚合计数，实时页 | 第 6 周起每天涨 | 25 万 / 500 万 |
| R3 | 公开数据集 | Hugging Face + Kaggle 下载数；DataShop（CMU，世界最大学习交互数据仓库，已确认在线，投稿政策待查） | 第 11–13 周 | 100 / 3,000 下载 |
| R4 | 三条预注册结果 | 仓库里带日期的预注册文件 + 分析报告 | 第 11–14 周 | 3 条，正负都报 |
| R5 | 人机比较 | 本地开源模型跑公共题库（你的 Mac，0 成本） | 第 13–15 周 | 10–20 个模型 |
| R6 | 生态 | FSRS 维护者讨论/issue、DataShop 收录、PsyArXiv 预印本、CogSci 2027 摘要（截止约 2 月 1 日，待核） | 持续 | 预印本 1 篇；摘要"已投" |

写法随级别增长的例子（同一活动，三个时点，全部大白话，见 §5）：
- 11 月：Built and released a free add-on for flashcard app Anki: asks how sure you are before each answer and shows students where they are overconfident.
- 1 月：+ "[N] students, [M] ratings, data public."
- 2 月：+ "made its forgetting forecasts [x]% more accurate" 或 "people feel surest about what they forget most (n = [M])."

---

## 3. 研究设计（分析前公开预注册：仓库里带日期的 `PREREG.md`，或 OSF）

**H1 真实环境中的 calibration 与 hard–easy effect。** 预测：整体过度自信，难题更甚。指标：reliability diagram、Brier、ECE（10 桶）、AUROC（JOL 预测正确）。模型：`correct ~ JOL + log(elapsed_days) + (1 + JOL | user)`。

**H2 JOL 是否追踪间隔。** 实验室结论：JOL 受重复次数驱动，对间隔不敏感。真实环境预测：JOL 与 FSRS 估算的 retrievability 的相关弱于实际正确率与 retrievability 的相关。模型：`JOL ~ log(scheduled_ivl) + retrievability + n_reviews + (1 | user)`。无论结果方向都报。

**H3 JOL 能否改进 FSRS 预测。** 在 srs-benchmark 框架上，每用户按时间切分；对照 = FSRS 的 retrievability；处理 = `logit(p) = logit(R_fsrs) + β·(JOL − mean)`（最简堆叠）。**验收标准（事先定）**：相对 log-loss 改善 ≥ 1%，且跨用户 bootstrap 95% CI 不含 0。不达标 = 报 null，数据集本身仍是贡献。

次要（探索性，明确标注）：中英文界面用户的 calibration 差异（Yates 等人的跨文化过度自信文献）；距上次复习时间长短对 JOL 准确度的影响（delayed-JOL effect 的真实环境版本）。

**R5 人机比较**：公共题库 300 题，本地跑 10–20 个开源模型（mlx-lm），同时取"口头信心 1–5"和 token 概率两种置信度；按题目难度分桶比较人和模型的 calibration 曲线。不对齐题目就只能做模式级比较，文档里说清用的是哪种。

### 你必须读完并能讲的 10 篇（1 月前）
Nelson & Narens 1990（元记忆框架）；Koriat 1997（cue-utilization）；Nelson & Dunlosky 1991（delayed-JOL effect）；Kornell & Bjork 2008（spacing 与 JOL）；Logan, Castel, Haber & Viehman 2012（Metacognition and the spacing effect）；Butterfield & Metcalfe 2001（hypercorrection）；Lichtenstein, Fischhoff & Phillips 1982（calibration 综述）；Yates, Lee & Shinotsuka 1996（跨文化过度自信）；Ye et al. 2022 KDD（FSRS 的论文）；Kadavath et al. 2022（模型 "know what they know"）。引用细节在写作前核一遍。

---

## 4. 数据与伦理路径（没有导师，全靠自己 — 你 10/3 定的）

不找教授、不走 IRB。走开源项目的标准路径：**opt-in 匿名数据**。先例：FSRS 的 anki-revlogs-10k 就是用户捐赠数据，无 IRB，被社区和论文正常使用。

必须齐的四样（齐了才开数据开关）：
1. 同意页：逐字段列出采集内容，明说"永不含卡片内容"，一键关闭。
2. 删除按钮：按 install_id 删光服务器上的数据。
3. `PRIVACY.md`：公开的隐私说明，写清存哪、存多久、谁能看。
4. 数据卡（data card）：发布数据集时说明采集方式、样本偏差、不能用来做什么。

口径纪律：对外只说 "anonymous, opt-in data from my free tool"。**不说** "human-subjects study"、不说 "IRB-approved"。预印本的 ethics statement 如实写：de-identified opt-in product data; independent project, no institutional affiliation.

没有导师时谁来把关（替代方案，每项都公开可查）：
- 预注册文件进仓库，git 时间戳就是证据。
- 分析代码 + 数据全开源，任何人可复现。
- 方法贴到 open-spaced-repetition 社区（srs-benchmark 的维护者就是这类数据的专家）和 r/Anki 征求批评，把收到的批评和修改记在仓库里。
- 发布渠道都不需要导师：GitHub、Hugging Face、Kaggle、PsyArXiv（无需 endorsement）、CogSci 2027 学生可独立投（投前核规则）。

**文献扫描（写任何 "first" 之前）**：Semantic Scholar 搜 "judgments of learning" × naturalistic / in-the-wild / Anki / Duolingo / flashcard。扫完之前只写 "an open dataset of [M] in-the-wild confidence ratings"。

**F1**：无偿、开源、无广告无打赏。合规。

---

## 5. 两套口径的实际文本（给招生官看的，全部大白话）

读者是文科背景、每份材料 8 分钟的招生官。规则：
- 活动栏里**不出现** JOL、FSRS、metamemory、calibration、spaced repetition、pre-registered。术语只留在 README、预印本、面试追问。
- 每句先说"做了什么、给谁、多少人"，再说"发现了什么"。
- 数字带大白话单位：students、ratings、answers。
- 品牌名只在加分时出现并带解释：Anki = "a flashcard app used by millions"。
- 少用 "AI"（你 8/30 的规则）。
- 发出去前过 **10 秒测试**：找一个非理工的人读一遍，让他复述你做了什么、给谁、规模多大。复述不出来就重写。

### 术语 → 大白话

| 术语 | 招生官能懂的说法 |
|---|---|
| Anki add-on | a free add-on for Anki, a flashcard app used by millions of students |
| judgment of learning / JOL | a "how sure are you?" rating before seeing the answer |
| calibration | whether people know what they know / whether confidence matches real memory |
| overconfidence / hard–easy effect | students feel surest about the material they most often forget |
| FSRS | the app's built-in algorithm that predicts forgetting and decides when you review |
| spaced repetition | flashcard study spread out over days and weeks |
| pre-registered | I published my hypotheses before looking at the data |
| open dataset | anonymous data shared free for other researchers |
| in the wild | during real studying, not in a lab |

### 5.1 Common App 活动栏（≤150 字符；1 月 25 日填数；字符数含实际数字已核）

**CS 版 · 数据阶段**（145）
> Built a free add-on for Anki, a flashcard app used by millions: rate how sure you are before each answer. [N] students, [M] ratings, data public.

**CS 版 · H3 出结果后（CMU 口径，算法改进放前面）**（146）
> Built a free add-on for flashcard app Anki: rate how sure you are before each answer. [N] users; made its forgetting forecasts [x]% more accurate.

**Cog sci 版 · 数据阶段**（142）
> Do students know what they know? My free flashcard tool logged [M] "how sure are you?" ratings from [N] learners, each matched to real recall.

**Cog sci 版 · 出结果后**（145；"feel surest about what they forget most" 只有数据支持才用，否则换成实际发现）
> Studied if students know what they know: [M] confidence ratings from [N] learners show they feel surest about what they forget most. Data public.

**11 月过渡版（数据未开）**
> CS（146）: Built and released a free add-on for flashcard app Anki: asks how sure you are before each answer and shows students where they are overconfident.
> Cog sci（145）: Turned flashcard study into a memory experiment: my free tool asks students how sure they are before each answer, then checks if they were right.

职位（≤50）：`Creator, developer and researcher`（33）
机构（≤100）：`HowSure — free study tool and memory research project (independent)`（67）

### 5.2 长版（~100 词，MIT 式长描述 / additional info）

**CS**
> Anki is a free flashcard app used by millions of students, from medical school to language learning. I built HowSure, a free add-on that asks one question before every answer is revealed: how sure are you? One keypress records the rating and flips the card, so studying takes no extra time. The add-on then shows each student where their confidence is wrong: the topics they feel sure about but keep forgetting. With permission, anonymous ratings from [N] students ([M] answers) form a public dataset, which I used to test whether confidence can improve the app's algorithm for deciding when to review each card. Code and data are open.

**Cog sci**
> Students waste hours re-studying what they already know and skipping what they have forgotten, because confidence and memory do not always agree. To study this at scale, I built a free add-on for the flashcard app Anki that asks "how sure are you?" before every answer. [N] learners contributed [M] anonymous ratings, each paired with whether they actually remembered. I published my hypotheses before looking at the data: Are people most overconfident on the hardest material? Does confidence track how long it has been since you last studied something, the way memory does? Can confidence improve how the app predicts forgetting? Findings and data are public.

### 5.3 面试 / 任何人问"你做了什么"的一句话
> I built a tool that asks students how sure they are before they see a flashcard answer, then used [M] of those answers to find out whether people actually know what they know.

### 5.4 Fit（按你 9/28 的 13 校名单 + 今天加的 HMC / CMU CS 预填；写 essay 前逐条核实括号里的名字）

| 学校 / 专业 | 一句 fit |
|---|---|
| MIT 6-9 Computation & Cognition | 项目就是 6-9 的定义：造工具（mens et manus）、采人类数据、建模。BCS 记忆与学习实验室 + EECS。(核具体 BCS 教员) |
| Stanford SymSys | Cognition / Learning 方向；中英 calibration 对照接 SymSys 的语言线；GSE 学习科学。(核 concentration 名称) |
| CMU SCS（CS）/ Dietrich CogSci | 学习工程发源地：HCII、LearnLab、DataShop（我的数据集的天然归宿）、Simon Initiative。两院口径同一套事实。(核 DataShop 投稿政策、HCII 教员) |
| Harvey Mudd CS | 教学为本的 CS 系、真实用户、"做对人有用的东西并量化它真的做了什么"。(核 HMC CS 教员的教育研究方向) |
| Michigan LSA CogSci（Decision & Cognition） | JOL 就是"对自己记忆的不确定判断"，是 D&C 轨的核心对象。 |
| Vanderbilt Peabody Cognitive Studies | Peabody 是教育学院：真实学习者的元认知数据直接对口。 |
| USC CogSci | 计算 + 认知，人机比较那条线。 |
| Brown Behavioral Decision Sciences | 过度自信与 calibration 是 BDS 的核心题。 |
| JHU Krieger CogSci | 计算取向；预测模型 + 人类判断。 |
| Columbia CC CogSci / UChicago CogSci / Penn CAS COGS | 通用认知科学口径：metamemory 文献 + 预注册 + 开放数据。 |
| Cornell CALS Information Science | HCI + 学习技术 + 数据：工具、管道、数据集三件套。 |
| Duke Psych + Decision Sciences 证书 | 同 Brown：判断的 calibration。 |
| UCLA（若在名单） | Bjork / Castel 实验室所在地，我们检验的正是他们的结论。 |

---

## 6. 执行计划（Opus 建，你驱动；周次从 10 月 5 日起）

| 周 | 做什么 | 你花的时间 |
|---|---|---|
| 1 | 建仓库；插件 v0.1（按键记录 + 翻面 + SQLite）；你每天用它复习；同意页文案 + PRIVACY.md 初稿 | 6–8 h（含读 Nelson & Narens、Kornell & Bjork） |
| 2 | Dashboard、双语、Win/Linux 测试、README（致谢 Anki Calibrate）、AnkiWeb 上架；预注册草稿 | 6 h |
| 3 | 发布：r/Anki、Anki 论坛、知乎（可选 B 站/小红书）、Show HN（可选）；预注册定稿并公开 | 6 h（帖子你写） |
| 4–6 | 数据开关上线（§4 四样齐）；实时统计页；公共题库 v1（你校对 300 题） | 4–6 h/周 |
| 7–10 | 数据积累；每周看实时页；联系 FSRS 维护者（GitHub discussion）；询问 DataShop 收录 | 3–4 h/周 |
| 11–14 | 数据集 v1（HF + Kaggle）；H1–H3 分析；R5 人机比较；写作 v1（PsyArXiv 预印本 + 中英博客） | 5–6 h/周（看懂每个数字） |
| 15–16 | 按社区反馈改稿；CogSci 2027 摘要（核截止）；**1 月 25 日冻结数字**；两套口径定稿（Michigan 2/1）；过 10 秒测试 | 4 h/周 |
| 17+ | 每批提交前刷新数字：2/15–16 批、3/1 批、3/15 批 | 1 h/周 |

总计：你约 80–100 小时 / 4 个月；Opus 约 2 周建设 + 1 周分析支持。

---

## 7. 所有权（面试和 essay 都要过得了）

- 能画出插件架构（hooks → pycmd → SQLite → Worker → 数据集）并解释为什么选"按键即翻面"。
- 能定义 Brier、ECE、AUROC、reliability diagram，并解释 mixed-effects 模型里 random slope 的含义。
- 能复述 H1–H3 及验收标准，能说出 H3 若为 null 为什么仍有价值。
- 能解释 FSRS 的 stability / difficulty / retrievability。
- 能说出局限：自选样本、仅桌面、opt-in 偏差、JOL 量表 1–5 的粗糙。
- Commit 历史在你名下、跨数月；"built with AI-assisted tooling" 可以如实说。

---

## 8. 风险与对策

| 风险 | 对策 |
|---|---|
| 用户少 | 你自己 + 愿意装的同学的数据已够 H1/H2 做案例级分析；H3 需要 ≥30 用户；双语 + 公共题库 + 带 dashboard 截图的帖子是拉新手段 |
| Anki 升级弄坏插件 | 跟 beta 测；"维护中"本身就是和已死先行者的差异 |
| 无导师（既定） | 公开预注册 + 可复现代码 + 社区审稿替代；口径只说 opt-in 匿名数据，不说 IRB 研究 |
| H3 为 null | 预注册过的 null 照报；数据集和 H1/H2 独立成立 |
| 误写 "first" | §4 文献扫描先行 |
| 看起来像"又一个插件" | 研究面和数据集是主体，插件是仪器；两套文本都这么写 |

---

## 9. 需要你定的 2 件事

1. 名字 HowSure 用不用（可改，不影响其它）。
2. 第 3 周要不要同时发中文平台（影响中英对照这条线；也是流量来源）。

已定：没有导师，走 §4 的 opt-in 匿名数据路径。名单按 9/28 的 13 校 + HMC 预填在 §5.4，有变动告诉我。定了就开工：Opus 第 1 周交 v0.1。
