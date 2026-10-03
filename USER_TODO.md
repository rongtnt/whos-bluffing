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
   域名：`*.pages.dev` 在中国大陆大概率打不开；中文渠道上线前买一个自定义域名（howsure.io 或 howsure.me 可注册；howsure.org / .app 已被注册）并在 Cloudflare 里绑定。
   规模：免费层每天 10 万次写 ≈ 10 万份完成卷；如果一天超过这个量，开 Workers Paid（5 美元/月）。
4. **校对题库**：`items/REVIEW.md` 逐条核对打勾（约 3–4 小时）。改错直接改 `items/items.json`，然后 `cd web && npm run sync-items`。这是你必须亲手做的部分：每道题的事实你要能当场说出来源。
5. **AnkiWeb 账号**（上传插件那天）：https://ankiweb.net/shared/addons/ → 上传 `anki/dist/howsure.ankiaddon`。
6. **发帖**（第 3 周）：文案草稿在 `posts/`，你改成自己的话再发。
