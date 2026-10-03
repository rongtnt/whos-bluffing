# HowSure for Slack

A Cloudflare Worker that brings the HowSure daily game to Slack. A workspace installs it once; every day it posts the game in a chosen channel; members play in a form; the channel post shows today's leaderboard.

## What members see

- A daily post: "HowSure #12 — 5 questions, give a range you're 90% sure about. Today's average so far: 2.8/5." with a **Play** button.
- **Play** opens a form with 5 questions. For each: a low and a high number.
- After **Submit**: a private result (🟩 truth inside your range, 🟥 outside, each true answer with its source). The daily post updates with players, average and the top 5.
- Commands:
  - `/howsure` posts today's game in the current channel.
  - `/howsure setup #channel [hour]` sets the daily channel and the UTC hour (default 14).
  - `/howsure stats` posts the 30-day leaderboard (top 10 by total hits; ties go to whoever played more) and how many members played.

A member who already played today gets their result again, not a second play.

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
   Paste the printed `database_id` into `wrangler.toml` (replace the zeros), then:
   ```bash
   npx wrangler d1 migrations apply howsure-slack --remote
   ```
3. **Point at the web API.** In `wrangler.toml` under `[vars]`, set `API_BASE` to the web deployment's origin. Default: `https://howsure.pages.dev`. Use the custom domain once it exists. No trailing slash, no `/api`.
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
   ```
   Secrets take effect at once; no redeploy needed. **Never change SALT**: every member id is hashed with it, so a new SALT turns every member into a new player (MAU counted twice, 30-day boards reset).
7. **Let other workspaces install** (skip if only your own workspace will use it): Slack app page → **Manage Distribution** → finish the checklist → **Activate Public Distribution**.
8. **Install.** Open `https://WORKER_HOST/slack/oauth/start` and press **Allow**. That URL is the **Add to Slack** link: share it, or link Slack's official Add to Slack button image to it.
9. **In Slack:**
   ```
   /howsure setup #general 14
   /howsure
   ```

## Secrets and vars (exact names)

| Name | Kind | Value |
|---|---|---|
| `SLACK_CLIENT_ID` | secret | Basic Information → App Credentials |
| `SLACK_CLIENT_SECRET` | secret | Basic Information → App Credentials |
| `SLACK_SIGNING_SECRET` | secret | Basic Information → App Credentials |
| `SALT` | secret | `openssl rand -hex 32`, set once, never change |
| `API_BASE` | var in `wrangler.toml` | web origin, e.g. `https://howsure.pages.dev` |

## Picking the channel

`/howsure setup #channel [hour]`. Type `#` and pick the channel so Slack links it. The hour is UTC, 0–23, default 14.

The Worker runs at the top of every hour and posts to each workspace once a day, as soon as its hour has come. If you set it up after that hour, today's game posts at the next full hour.

Public channels work without inviting the app. For a private channel, run `/invite @HowSure` in it before setup.

## Deploy and update

```bash
npm test                                       # all tests, mocked Slack and daily API
npx wrangler deploy --dry-run --outdir dist    # bundle check, uploads nothing
npx wrangler deploy
npx wrangler tail                              # live logs (short error codes only)
```

## Data and tokens

Stored in D1: team id, bot token, channel id, post hour, post timestamps, and per-day hits keyed by `sha256(team_id:user_id:SALT)`. No message text, names or emails. Display names are fetched from Slack only while a leaderboard is drawn and are never stored. The daily API receives only the hashed member id and a hashed workspace id (`sha256(team_id:SALT)`), never raw Slack ids.

**Bot tokens are stored in plain text** in the D1 table `installs`.

- Rotate one workspace's token: reinstall from the Add to Slack link. The callback overwrites the stored token and keeps the channel and hour.
- Revoke every token (for example if the database leaked): Slack app page → **OAuth & Permissions** → **Revoke All OAuth Tokens**, then each workspace reinstalls.
- Rotate the app secrets: **Basic Information** → regenerate the Client Secret or Signing Secret, then `npx wrangler secret put` the new value.
- When a workspace uninstalls, Slack revokes its token; the next hourly post sees that and deletes the workspace's row.

## Limits

- Leaderboard names: only members of the channel the board is in (up to 1000 members) can be named. Others show as "a teammate".
- Any member can run `/howsure setup`.
- The private result uses Slack's response link, which lasts 30 minutes after pressing Play. After that, press Play again to see the result.
- The board is updated once per finished play. Very busy workspaces may hit Slack's rate limits at peak times; plays still count.
- Workers free plan allows 10 ms CPU per request. Name lookups hash up to 1000 member ids, so big channels, or hundreds of workspaces in one hourly run, may need Workers Paid ($5/month).
- Workspace installs only; Enterprise Grid org-wide installs are not supported.
- Not in the Slack App Directory yet; installs go through the Add to Slack link.
- When the web API at `API_BASE` is down, members see "HowSure is taking a break, try again in a minute." and the hourly post retries the next hour.
