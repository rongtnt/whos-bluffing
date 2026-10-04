# HowSure for Slack

A Cloudflare Worker that posts one HowSure question a day in a Slack channel. Members pick A or B and say how sure they are, privately. Hours later the answer is revealed in the same message, with the workspace's points and the day's biggest bluff. Every Monday a recap shows how well calibrated the workspace was last week.

## What members see

- **The daily post**, at the workspace's hour: "HowSure · Which is longer: the Nile or the Danube?" with two buttons, **A · the Nile** and **B · the Danube**.
- **Tap A or B:** a private confidence picker appears, only for you: 50% (coin flip), 60%, 70%, 80%, 90%, 100% (stake it all).
- **Tap a confidence:** the picker turns into "Locked in: B at 80%. Reveal at 22:00 UTC." Nobody else sees your pick, and you get no hint whether you were right.
- **Change your mind** before the reveal: tap A or B again and pick a new confidence. The picker shows your current answer; the last answer counts.
- **The reveal** edits the original post (the buttons go away):
  - the correct answer with both values and their sources;
  - "12 answered · 75% A · 25% B";
  - the top 5 by points, by display name;
  - the bluff line, when the day's biggest bluff is a wrong answer at 80% or more: "Someone was 90% sure it was B (the Danube). It wasn't."
- **The Monday recap** (posted at the workspace's hour, before that day's question): how often each confidence level was right last week, the most calibrated member by name, the bluff count, days played and the workspace's streak.

### Points

Each answer scores 100 − 400 × (confidence − outcome)², with confidence as a fraction and outcome 1 when right, 0 when wrong. 50% always scores 0; 100% scores +100 when right and −300 when wrong. Honest confidence earns the most points over time.

Nothing is scored before the reveal: when you lock in, the web API confirms the answer without saying whether it is right. At the reveal the Worker scores every answer against the revealed answer with this formula (the same one the API uses).

A **bluff** is a wrong answer at 80% or more. The reveal's bluff line and the recap's bluff count both use this rule.

### Roast mode

Off by default. With roast mode off:

- the bluff line says "Someone", never a name;
- the points list on the reveal and in `/howsure stats` shows only members with more than 0 points, so nobody is named next to a loss.

`/howsure setup roast on` names the biggest bluffer in the reveal and shows everyone's points, negative ones included. `/howsure setup roast off` turns it back off. Any member can change it.

### Reveal timing

The answer is revealed 8 hours after the post hour, at the top of the hour (post hour 14 → reveal 22:00 UTC). If the day's post went up later than the post hour (for example, the channel was set up in the evening), the reveal is 8 hours after the hour it went up, so everyone still gets the full 8 hours. The post and the "Locked in" reply both show the reveal time. Anyone can reveal early with `/howsure reveal`.

A question can be answered until its reveal, and only on its day or the day after (a post at 20:00 is revealed at 04:00 the next day).

## Commands

| Command | What it does |
|---|---|
| `/howsure` | Posts today's question in this channel. In the chosen channel (or when none is chosen yet) it becomes the day's post, and the hourly post skips that day; if the day's post is already in this channel, it says so instead of posting twice. Elsewhere it posts a copy: answers count the same, and the reveal happens on the day's post. After today's reveal it posts nothing and says so. |
| `/howsure setup #channel [hour] [roast on\|off]` | Posts the question in #channel every day at that hour, in UTC (0–23, default 14). Without an hour the hour is set to 14. |
| `/howsure setup roast on\|off` | Changes roast mode only; channel and hour stay. |
| `/howsure reveal` | Reveals the open question now, for everyone. |
| `/howsure stats` | Posts this workspace's 30-day leaderboard in the channel: top 10 by total points (ties: more answers first) and how many members answered. Only revealed days count. |

Anything else shows the command list privately.

## Set up (about 15 minutes)

You need a Cloudflare account (free plan is fine), a Slack workspace where you may install apps, and Node 22.13 or newer (the tests use Node's built-in SQLite).

1. **Install and log in**
   ```bash
   cd ~/howsure/slack
   npm install
   npx wrangler login
   ```
2. **Create the database**
   ```bash
   npx wrangler d1 create howsure-slack
   ```
   Paste the printed `database_id` into `wrangler.toml` (replace the zeros), then apply both migrations:
   ```bash
   npx wrangler d1 migrations apply howsure-slack --remote
   ```
3. **Point at the web API.** In `wrangler.toml` under `[vars]`, set `API_BASE` to the web deployment's origin. Default: `https://howsure.pages.dev`. Use the custom domain once it exists. No trailing slash, no `/api`. The Worker calls `/api/round/daily-question`, `/api/round/answer` and `/api/round/reveal` (see `docs/api-rounds.md`).
4. **Deploy once to get the URL**
   ```bash
   npx wrangler deploy
   ```
   It prints `https://howsure-slack.<your-subdomain>.workers.dev`. Its host (without `https://`) is `WORKER_HOST` below.
5. **Create the Slack app.** In `manifest.yaml`, replace `YOUR-WORKER-HOST` (3 places) with `WORKER_HOST`. Open https://api.slack.com/apps → **Create New App** → **From an app manifest** → pick your workspace → paste the YAML → **Next** → **Create**.
6. **Store the secrets.** On the Slack app page → **Basic Information** → **App Credentials**:
   ```bash
   npx wrangler secret put SLACK_CLIENT_ID        # paste the Client ID
   npx wrangler secret put SLACK_CLIENT_SECRET    # paste the Client Secret
   npx wrangler secret put SLACK_SIGNING_SECRET   # paste the Signing Secret
   openssl rand -hex 32                           # copy this value and keep a copy in your password manager
   npx wrangler secret put SALT                   # paste it
   npx wrangler secret put BOT_KEY                # paste the BOT_KEY set on the web project
   ```
   `BOT_KEY` is the shared key the web API expects in the `x-howsure-bot` header on every call (it needs it for same-day reveals, and the rate limit skips requests that carry it). Use the value set on the web project; if it has none yet, make one with `openssl rand -hex 32` and set it on both. Without it every call to the web API fails and members see "taking a break".
   Secrets take effect at once; no redeploy needed. **Never change SALT**: every member id is hashed with it, so a new SALT turns every member into a new player (MAU counted twice, boards and streaks reset).
7. **Let other workspaces install** (skip if only your own workspace will use it): Slack app page → **Manage Distribution** → finish the checklist → **Activate Public Distribution**.
8. **Install.** Open `https://WORKER_HOST/slack/oauth/start` and press **Allow**. That URL is the **Add to Slack** link: share it, or link Slack's official Add to Slack button image to it.
9. **In Slack:**
   ```
   /howsure setup #general 14
   /howsure
   ```

Already set up v0.1? Run step 2's `migrations apply` again (it adds `0002_daily_question.sql`), update the app from the new `manifest.yaml` (Slack app page → **App Manifest**), and deploy.

## Secrets and vars (exact names)

| Name | Kind | Value |
|---|---|---|
| `SLACK_CLIENT_ID` | secret | Basic Information → App Credentials |
| `SLACK_CLIENT_SECRET` | secret | Basic Information → App Credentials |
| `SLACK_SIGNING_SECRET` | secret | Basic Information → App Credentials |
| `SALT` | secret | `openssl rand -hex 32`, set once, never change |
| `BOT_KEY` | secret | the same value as the web project's `BOT_KEY` |
| `API_BASE` | var in `wrangler.toml` | web origin, e.g. `https://howsure.pages.dev` |

## Picking the channel

`/howsure setup #channel [hour]`. Type `#` and pick the channel so Slack links it. The hour is UTC, 0–23, default 14.

The Worker runs at the top of every hour. Each run, in this order: reveals the questions that are due, posts Monday recaps, then posts today's question to each workspace once, as soon as its hour has come. If you set it up after that hour, today's question posts at the next full hour (and is revealed 8 hours after that).

Public channels work without inviting the app. For a private channel, run `/invite @HowSure` in it before setup.

## Deploy and update

```bash
npm test                                       # all tests, mocked Slack and rounds API
npx wrangler deploy --dry-run --outdir dist    # bundle check, uploads nothing
npx wrangler deploy
npx wrangler tail                              # live logs (short error codes only)
```

## Data and tokens

Stored in D1, and nothing else:

- per workspace: team id, bot token, channel id, post hour, roast setting, the Monday of the last recap;
- per workspace per day: the day's post (channel id and message timestamp), whether it was revealed, and the day's question as the API served it (item id, prompt and both options: HowSure's own text, kept so a late reveal can still be drawn);
- per answer: `sha256(team_id:user_id:SALT)`, the date, A or B, the confidence, and, from the reveal on, whether it was right and its points.

No member messages, names or emails. Display names are fetched from Slack only while a reveal, leaderboard or recap is drawn, and are never stored. The rounds API receives only the hashed member id and `slack:` + a hashed workspace id (`sha256(team_id:SALT)`), never raw Slack ids. Every call to it carries the `x-howsure-bot` header with `BOT_KEY`. The v0.1 table `scores` is no longer used.

**Bot tokens are stored in plain text** in the D1 table `installs`.

- Rotate one workspace's token: reinstall from the Add to Slack link. The callback overwrites the stored token and keeps the channel, hour and roast setting.
- Revoke every token (for example if the database leaked): Slack app page → **OAuth & Permissions** → **Revoke All OAuth Tokens**, then each workspace reinstalls.
- Rotate the app secrets: **Basic Information** → regenerate the Client Secret or Signing Secret, then `npx wrangler secret put` the new value.
- Rotate `BOT_KEY`: set the new value on the web project and here at the same time (`npx wrangler secret put BOT_KEY`).
- When a workspace uninstalls, Slack revokes its token; the next hourly post sees that and deletes the workspace's row.

## Limits

- Names: only members of the channel the message is in (up to 1000 members) can be named. Others show as "a teammate". The same goes for the bluffer in roast mode ("Someone" when not found).
- Any member can run `/howsure setup` and `/howsure reveal`.
- The confidence picker uses Slack's response link, which lasts 30 minutes after tapping A or B. After that, tap A or B again.
- Copies posted with `/howsure` outside the chosen channel are not edited at the reveal; tapping them afterwards says the question is closed.
- If a reveal fails (web API down, Slack error), it is retried every hour for up to a week, drawn from the question stored with the post; `/howsure reveal` also retries.
- Workers free plan allows 10 ms CPU per request. Name lookups hash up to 1000 member ids, so big channels, or hundreds of workspaces in one hourly run, may need Workers Paid ($5/month).
- Workspace installs only; Enterprise Grid org-wide installs are not supported.
- Not in the Slack App Directory yet; installs go through the Add to Slack link.
- When the web API at `API_BASE` is down, members see "HowSure is taking a break, try again in a minute." and the hourly post retries the next hour.
