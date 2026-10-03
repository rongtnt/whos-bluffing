# 只有你能做的事（按先后）

1. **装 Anki**（如果 v2 插件要有你自己的数据）：https://apps.ankiweb.net 下载 26.09.x。装完每天用它背点东西（任何内容都行），否则插件没有 dogfood、也没有你的数据，面试时"你自己用吗"答不上来。
2. **GitHub 私有仓库 + 推送**（在 `~/howsure` 下执行；仓库已配置作者 `Ethan <281587629+rongtnt@users.noreply.github.com>`，提交会挂到你的账号，想改名字告诉我）：
   ```bash
   gh repo create howsure --private --source=. --remote=origin --push
   ```
   上线那天改公开：
   ```bash
   gh repo edit rongtnt/howsure --visibility public --accept-visibility-change-consequences
   ```
3. **Cloudflare**（免费账号即可）：
   ```bash
   cd ~/howsure/web && npx wrangler login
   npx wrangler d1 create howsure        # 把输出的 database_id 粘进 wrangler.toml 的 [[d1_databases]]
   npx wrangler d1 migrations apply howsure --remote
   npm run sync-items                    # 题库同步到 public/ 和 functions/
   npx wrangler pages deploy public --project-name howsure
   ```
   然后在 Cloudflare 控制台给 `/api/*` 加一条免费的 rate-limit 规则（例如每 IP 每分钟 20 次）。这不经过我们的数据库，不存 IP。
   KPI 任务：`openssl rand -hex 32` 生成一个 KPI_KEY，**设两次**——Pages 项目的 secret（`npx wrangler pages secret put KPI_KEY`）和 `web/kpi-worker/` 的 Worker secret；然后 `cd web/kpi-worker && npx wrangler deploy`（它每天调用一次 `/api/kpi/run`，统计页的 MAU 从这里来）。
   域名：站点里写死了 `howsure.me`（sitemap、robots、分享文案）和 `howsure.pages.dev`（KPI Worker 的 RUN_URL）；买了别的域名就全局替换这两处。
   域名：买一个短域名用于分享文案和 Slack 应用（howsure.io 或 howsure.me 可注册；howsure.org / .app 已被注册），在 Cloudflare 里绑定。
   规模：免费层每天约 7,500 份完成卷（写入是瓶颈：每份约 8–13 行）；一天超过这个量就开 Workers Paid（5 美元/月）。读取已做成常数级，不会因为样本变大而崩。
4. **校对题库**：`items/REVIEW.md` 逐条核对打勾（约 3–4 小时）。改错直接改 `items/items.json`，然后 `cd web && npm run sync-items`。这是你必须亲手做的部分：每道题的事实你要能当场说出来源。
   **每晚 2 分钟的仪式（上线后天天做）**：`cd ~/howsure/web && npm run tomorrow` 打印明天的 5 题和来源；有问题的题直接改 `daily/schedule.json` 里那一天的 id（从 `items/pool.json` 挑同类别、未排期的替换），提交。Wikidata 数据有脏的（已知例子：某些桥的长度、法国面积含海外省、某大学建校年份有争议），这一步就是质量门。上线前两周（10/17–10/31）的 75 题我已经替换过明显有问题的。
5. **AnkiWeb 账号**（上传插件那天）：https://ankiweb.net/shared/addons/ → 上传 `anki/dist/howsure.ankiaddon`。
6. **Slack 应用注册**（只有你能做，约 15 分钟）：到 https://api.slack.com/apps → Create New App → From an app manifest → 粘贴 `slack/manifest.yaml` → 在 Basic Information 复制 Client ID / Client Secret / Signing Secret → 按 `slack/README.md` 用 `npx wrangler secret put` 写入四个密钥（SLACK_CLIENT_ID、SLACK_CLIENT_SECRET、SLACK_SIGNING_SECRET、SALT；**SALT 用 `openssl rand -hex 32` 生成，之后永远不能改**，改了所有成员都会被当成新用户）→ `wrangler.toml` 填 database_id 和 API_BASE → `manifest.yaml` 里 3 处 YOUR-WORKER-HOST 换成你的 Worker 域名 → 部署 → Slack 应用页 Manage Distribution → Activate Public Distribution → 用 "Add to Slack" 链接装进你自己的一个测试工作区。App Directory 上架是后话，不阻塞。
7. **发布日历**（都是你发；草稿在 `posts/`，改成自己的话）：
   - 10/20（周二）Show HN（`posts/show-hn.md`）+ r/InternetIsBeautiful + r/samplesize（`posts/reddit-samplesize.md`）+ LessWrong / EA Forum 短帖（`posts/lesswrong.md`）+ 给 Astral Codex Ten / forecasting newsletter 发一封邮件（`posts/newsletter-email.md`）
   - 10/21 r/Professors 课堂帖（`posts/reddit-professors.md`）+ 发给你认识的 3 位老师（`posts/instructor-pitch.txt`）
   - 11/18（周二）Product Hunt 上线 Slack 应用 + 每日一局（`posts/producthunt.md`）；同日 r/slack、r/startups
   - 12 月：第一篇数据帖（结果本身可晒）；1/25 冻结数字
   中文平台不做（英文单语）。
