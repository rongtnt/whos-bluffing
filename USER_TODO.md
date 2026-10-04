# 只有你能做的事（按先后）

0. ~~买域名 whosbluffing.com~~ **已买（2026-10-04，Cloudflare Registrar）**。站点、Slack、Discord 的所有链接按这个域名配置。
0b. **GitHub 仓库改名**（配合全仓库改名，GitHub 会自动重定向旧链接）：
   ```bash
   gh repo rename whos-bluffing -R rongtnt/howsure --yes
   ```
   以后 Slack 应用和 Discord 应用注册时名字都用 "Who's Bluffing?"。

1. **Anki 已装好（26.9.3，/Applications/Anki.app），Who's Bluffing 插件已放进插件目录（addons21/whosbluffing）。** 你只需：打开 Anki → 建个 profile → File → Import 导入 `anki/dist/WhosBluffing-Calibration-Deck-en.apkg` → 复习时按 1–5 打把握再看答案 → Tools → "Who's Bluffing: my calibration" 看曲线。每天背点东西（任何内容都行），否则没有你自己的数据。GUI 检查清单在 `anki/TESTING.md`。
2. **推送到 GitHub**：私有仓库 https://github.com/rongtnt/whos-bluffing（0b 改名后的地址）我已经建好并设为 origin，分支已改名 main；只有 push 这一步被你 `~/.claude/settings.json` 里的守卫（任何含 "push" 的命令都拦）挡住，你跑一行：
   ```bash
   cd ~/howsure && git push -u origin main
   ```
   推上去后 GitHub Actions 会自动跑 `scripts/check.sh`（`.github/workflows/ci.yml`）。上线前后的步骤清单在 `docs/LAUNCH_RUNBOOK.md`。
   上线那天改公开：
   ```bash
   gh repo edit rongtnt/whos-bluffing --visibility public --accept-visibility-change-consequences
   ```
3. **Cloudflare — 大部分已做完（2026-10-04）**：D1 数据库 whosbluffing 已建并迁移、Pages 项目 whosbluffing 已部署（https://whosbluffing.pages.dev 在线）、KPI_KEY / BOT_KEY 已设（本机副本在 `web/.dev.vars`，已 git-ignore，别提交别外传）。还差 3 个控制台动作（约 5 分钟）：
   - **Workers 子域名（必须，KPI 定时任务和 Slack/Discord 两个 Worker 都靠它）**：Workers & Pages → Overview → 右侧 "Subdomain" → Set up → 填 `whosbluffing` → 保存。做完告诉我，我重新部署 KPI Worker。
   - **绑定域名**：Workers & Pages → whosbluffing → Custom domains → Set up a custom domain → `whosbluffing.com` → Activate（DNS 自动建）。再加一次 `www.whosbluffing.com`。
   - **限流规则**：Security → WAF → Rate limiting rules → Create：表达式 `(http.request.uri.path contains "/api/") and not (any(http.request.headers["x-bluff-bot"][*] eq "<BOT_KEY 的值，在 web/.dev.vars 里>"))`，120 次/分钟/IP，Block 60 秒。
   规模：免费层每天约 7,500 份完成局（写入是瓶颈）；超过就开 Workers Paid（5 美元/月）。
4. **校对题库**：`items/REVIEW.md` 逐条核对打勾（约 3–4 小时）。改错直接改 `items/items.json`，然后 `cd web && npm run sync-items`。这是你必须亲手做的部分：每道题的事实你要能当场说出来源。
   **每晚 2 分钟的仪式（上线后天天做）**：`cd ~/howsure/web && npm run tomorrow` 打印明天的 5 题和来源；有问题的题直接改 `daily/schedule.json` 里那一天的 id（从 `items/pool.json` 挑同类别、未排期的替换），提交。Wikidata 数据有脏的（已知例子：某些桥的长度、法国面积含海外省、某大学建校年份有争议），这一步就是质量门。上线前两周（10/17–10/31）的 75 题我已经替换过明显有问题的。
5. **AnkiWeb 账号**（上传插件那天）：https://ankiweb.net/shared/addons/ → 上传 `anki/dist/whosbluffing.ankiaddon`。
6. **Slack 应用注册**（只有你能做，约 15 分钟）：到 https://api.slack.com/apps → Create New App → From an app manifest → 粘贴 `slack/manifest.yaml` → 在 Basic Information 复制 Client ID / Client Secret / Signing Secret → 按 `slack/README.md` 用 `npx wrangler secret put` 写入四个密钥（SLACK_CLIENT_ID、SLACK_CLIENT_SECRET、SLACK_SIGNING_SECRET、SALT；**SALT 用 `openssl rand -hex 32` 生成，之后永远不能改**，改了所有成员都会被当成新用户）→ `wrangler.toml` 填 database_id 和 API_BASE → `manifest.yaml` 里 3 处 YOUR-WORKER-HOST 换成你的 Worker 域名 → 部署 → Slack 应用页 Manage Distribution → Activate Public Distribution → 用 "Add to Slack" 链接装进你自己的一个测试工作区。App Directory 上架是后话，不阻塞。
7. **Discord 应用注册**（约 20 分钟，按 `discord/README.md`）：https://discord.com/developers → New Application → 复制 Application ID 和 Public Key → Bot 页拿 Token、打开 Server Members Intent → 密钥写入 Worker（DISCORD_PUBLIC_KEY、DISCORD_BOT_TOKEN、SALT、BOT_KEY）→ 部署 → 在 Portal 填 Interactions Endpoint URL → `node discord/scripts/register-commands.mjs` 注册命令 → 用 `/install` 链接装进你自己的测试服务器。上架 top.gg 和 App Directory 的文案在 `posts/discord-listing.md`。
8. **对标 Truth or Dare 站点还需要你开的三个账号**（各 5 分钟）：
   - Who's Bluffing 社区 Discord 服务器：discord.com → 新建服务器 → 建 #daily-reveal、#feedback、#play 三个频道 → 生成永久邀请链接，发给我填进 `COMMUNITY_INVITE_URL`。
   - 邮箱：Cloudflare 控制台 → Email Routing → 建 hello@whosbluffing.com 转发到你的邮箱（域名绑定后），发我填进 `CONTACT_EMAIL`。
   - 项目的 X 或 Bluesky 账号（可选）：建好把链接给我。
9. **发布日历**（都是你发；草稿在 `posts/`，改成自己的话）：
   - 10/20（周二）Show HN（`posts/show-hn.md`）+ r/InternetIsBeautiful + r/samplesize（`posts/reddit-samplesize.md`）+ LessWrong / EA Forum 短帖（`posts/lesswrong.md`）+ 给 Astral Codex Ten / forecasting newsletter 发一封邮件（`posts/newsletter-email.md`）
   - 10/21 r/Professors 课堂帖（`posts/reddit-professors.md`）+ 发给你认识的 3 位老师（`posts/instructor-pitch.txt`）
   - 11/18（周二）Product Hunt 上线 Slack 应用 + 每日一局（`posts/producthunt.md`）；同日 r/slack、r/startups
   - 12 月：第一篇数据帖（结果本身可晒）；1/25 冻结数字
   中文平台不做（英文单语）。
10. **iOS App（第二阶段，你准备好 Apple Developer 账号 $99/年时告诉我）**：SwiftUI 客户端接现有 rounds API，原生分享、每日一题小组件、揭晓通知（可选）、Game Center 排名榜。App Store 是第四个分发入口。

