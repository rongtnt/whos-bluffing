# whosbluffing-x

A Cloudflare Worker with two jobs:

1. **Watch** the people in `src/watch.js` (AI lab leaders, researchers, founders, investors). Every two minutes it asks
   X for their new posts and, for each one, sends a Discord message to a private channel with the post, a polite
   personalised dare ("Mr. Altman, I would bet you can't get all ten of these right: …?pack=ai&difficulty=brutal"), and
   a prefilled reply link. You tap the link on your phone, read the draft, and press Post. Nothing is replied
   automatically: X's automation rules forbid scripted replies to people who did not ask for them, and the account
   carries Premium.
2. **Post** as @whos_bluffing on request: `POST /post` with the shared key, for link-free posts and scheduled replies.

## Setup (once, about ten minutes; needs you, not me)

1. Sign in to https://developer.x.com as **@whos_bluffing** and sign up for the pay-per-use plan. Add a card: X gives
   $20 in credits for the first card and matches the first auto-recharge up to $50. Accept the developer terms.
2. Create a Project and an App (name: Who's Bluffing).
3. App → **User authentication settings** → Set up: App permissions **Read and write**; Type of App **Web App,
   Automated App or Bot**; Callback URI `https://whosbluffing.com/`; Website URL `https://whosbluffing.com`. Save.
4. App → **Keys and tokens**: generate and copy the **API Key and Secret**, the **Bearer Token**, and the **Access Token
   and Secret** (the access token must say "Created with Read and Write permissions"; if it says Read, regenerate it
   after step 3).
5. Set the secrets, one command at a time, pasting one value each:
   ```bash
   cd ~/howsure/x && npx wrangler secret put X_BEARER_TOKEN
   ```
   ```bash
   cd ~/howsure/x && npx wrangler secret put X_API_KEY
   ```
   ```bash
   cd ~/howsure/x && npx wrangler secret put X_API_SECRET
   ```
   ```bash
   cd ~/howsure/x && npx wrangler secret put X_ACCESS_TOKEN
   ```
   ```bash
   cd ~/howsure/x && npx wrangler secret put X_ACCESS_SECRET
   ```
6. Discord: in the community server create a private channel `#x-alerts` → Edit channel → Integrations → Webhooks →
   New Webhook → Copy Webhook URL, then:
   ```bash
   cd ~/howsure/x && npx wrangler secret put ALERT_WEBHOOK
   ```
7. First poll (records where each timeline is; alerts start with the next new post):
   ```bash
   curl -s -X POST https://whosbluffing-x.rongaijun41.workers.dev/poll -H "x-bluff-bot: $BOT_KEY"
   ```

`BOT_KEY` is already set (the same value as the web and bot Workers). No redeploy is needed after setting secrets.

## Using the alerts

- Reply within ten minutes or skip it. One reply per person per day; the alert says when it is their second post.
- Keep to about 15 replies a day across all accounts. The same link under 100 famous accounts a day from one account
  is what X's spam filter hides and suspends; if your replies start landing under "Show more replies", stop for two days.
- Skip somber posts (the alert says so when it can tell) and never argue with the account holder.

## Posting through the API

```bash
curl -s -X POST https://whosbluffing-x.rongaijun41.workers.dev/post -H "x-bluff-bot: $BOT_KEY" \
  -H 'content-type: application/json' -d '{"text":"…","reply_to":"<post id, optional>"}'
```

Prices (docs.x.com, October 2026): a post read $0.005, a user lookup $0.010, a post created $0.015, a post created
**with a URL $0.200**. Posts with links go out by hand from the browser, which is free; the API is for link-free
text and for the monitor. Watching 40 accounts costs roughly their new posts × $0.005 a day, well under a dollar.

## Develop

```bash
npm test
npx wrangler deploy
```
