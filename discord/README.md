# Who's Bluffing? for Discord

A Cloudflare Worker that brings Who's Bluffing to Discord. A server adds it once. Every day it posts one question in a chosen
channel. Members tap A or B and say how sure they are. Eight hours later the post turns into the answer, with this
server's top 5 and the bluff of the day.

## What members see

- **The daily post:** "Who's Bluffing? · Which is longer: the Nile or the Danube?" with buttons **A · the Nile** and **B · the Danube**.
- **Tapping A or B** opens a private confidence picker: 50% (coin flip), 60, 70, 80, 90, 100% (stake it all). Then a
  private "Locked in: B at 80%. Reveal at 22:00 UTC." Changing your mind before the reveal is allowed; the last answer counts.
- **The reveal** edits the post. It shows both true values with their sources, "12 answered · 75% A · 25% B", the top 5
  by points, and the bluff line. With roast mode off: "Someone was 90% sure the Danube is longer. It isn't." With
  roast mode on, the bluffer is named.
- **Points** follow the quadratic rule: 50% scores 0; 100% scores +100 if right and −300 if wrong.
- **Mondays:** a recap of last week. It shows how often the server was right at each confidence level, the most
  calibrated member (named), the bluff count (80%+ sure and wrong), and the streak of days with an answer.

## Commands

| Command | Who | What |
|---|---|---|
| `/bluff question` | anyone | Post today's question in this channel now. If today's is already up, it links to it. |
| `/bluff play` | anyone | A private 10-question round: A/B, then confidence, then the answer with points, then Next. Ends with score, type and roast line, plus a **Challenge** button that posts your challenge link in the channel. |
| `/bluff stats` | anyone | This server's 30-day leaderboard (top 10 by points) and participation, posted in the channel. |
| `/bluff setup` | Manage Server | `channel`, `hour` (UTC, 0–23, default 14), `roast` (on/off, default off). Every option is optional; a missing one keeps its value. |
| `/bluff reveal` | Manage Server | Reveal today's answer now instead of waiting. |
| `/bluff help` | anyone | How it works and the command list. |
| `/bluff invite` | anyone | The link to add Who's Bluffing to another server. |

Discord cannot run a command that has subcommands without one, so "post today's question now" is
`/bluff question`, not a bare `/bluff`.

**Reveal timing.** The Worker runs at the top of every hour. It posts to each server once a day, as soon as the
server's hour has come. It reveals each post at the first hourly run at least 8 hours after posting (posted 14:00 →
revealed 22:00 UTC). Answers close at the reveal.

## Set up (about 20 minutes)

You need a Cloudflare account (the free plan is fine), a Discord server where you have Manage Server, and Node 22.13
or newer (the tests use Node's built-in SQLite).

**1. Create the Discord app (3 min).** Go to https://discord.com/developers/applications → **New Application** →
name it `Who's Bluffing?` → **Create**. On **General Information**:

- Copy the **Application ID** and the **Public Key**.
- Upload an icon, and paste a description from `posts/discord-listing.md`.

**2. Set up the bot user (2 min).** Open the **Bot** page:

- **Reset Token** → copy the token. It is shown once; keep it in your password manager.
- Leave **Public Bot** on, so other servers can add it.
- Under **Privileged Gateway Intents**, turn on **Server Members Intent**. Without it, leaderboards show "a member"
  instead of names. Everything else works.
- **Save Changes**.

**3. Install settings (1 min).** Open the **Installation** page:

- Under **Installation Contexts**, keep **Guild Install** only (untick User Install).
- Set **Install Link** to **Discord Provided Link**.
- Under **Default Install Settings** → Guild Install, set scopes `applications.commands` and `bot`, and permissions
  **Send Messages**, **Embed Links** and **Read Message History**. That is the same as the Worker's `/install` link
  (permissions integer `83968`).

**4. Database and Worker (5 min).**

```bash
cd discord   # from the repository root
npm install
npx wrangler login
npx wrangler d1 create whosbluffing-discord
```

Then:

1. Paste the printed `database_id` into `wrangler.toml` (replace the zeros).
2. In `wrangler.toml`, set `DISCORD_APP_ID` to the Application ID.
3. Set `API_BASE` to the web deployment's origin. The default is `https://whosbluffing.pages.dev`; use the custom domain
   once it exists. No trailing slash, no `/api`.

Then:

```bash
npx wrangler d1 migrations apply whosbluffing-discord --remote
npx wrangler deploy
```

The deploy prints `https://whosbluffing-discord.<your-subdomain>.workers.dev`. That is `WORKER_URL` below.

**5. Secrets (2 min).**

```bash
npx wrangler secret put DISCORD_PUBLIC_KEY    # paste the Public Key (General Information)
npx wrangler secret put DISCORD_BOT_TOKEN     # paste the bot token (Bot page)
openssl rand -hex 32                          # copy this value and keep a copy in your password manager
npx wrangler secret put SALT                  # paste it
npx wrangler secret put BOT_KEY               # paste the web project's BOT_KEY (the same value the Slack worker uses)
```

Secrets take effect at once; no redeploy is needed. **Never change SALT.** Every member id is hashed with it, so a new
SALT turns every member into a new player: MAU is counted twice and the boards reset.

**BOT_KEY** goes out as the `x-bluff-bot` header on every call to the web API. The API needs it to reveal today's
question, and the rate limit on `/api/*` exempts it. Without it every API call is refused at once and members see
"taking a break". To rotate it, change it on the web project and on every bot together.

**6. Interactions Endpoint URL (1 min).** On **General Information**, set **Interactions Endpoint URL** to
`WORKER_URL/interactions` and press **Save Changes**. Discord checks the URL there and then: it sends one signed
request and one deliberately bad one, and saves only if the Worker answers both correctly. If saving fails, check
DISCORD_PUBLIC_KEY.

**7. Register the command (1 min).**

```bash
DISCORD_APP_ID=<application id> DISCORD_BOT_TOKEN=<bot token> npm run register    # prints: Registered: /bluff
```

Run it again whenever `COMMANDS` in `src/commands.js` changes. It replaces the whole list, so repeats are harmless.

**8. Add it to your server (1 min).** Open `WORKER_URL/install` → pick your server → **Authorize**. That URL is the
invite link. Share it, or use the Add App button that Discord shows on the app's profile.

**9. In Discord (2 min):**

```
/bluff setup channel:#general hour:14
/bluff question
```

Then:

1. Tap A or B, pick a confidence, and see "Locked in".
2. Run `/bluff reveal` to see a reveal right away.
3. Run `/bluff play` to try a full round.

## List it on top.gg and in the App Directory

Copy for both is in `posts/discord-listing.md`. Let the bot run in your own server for a few days before submitting.

**top.gg.** Sign in at https://top.gg with Discord.

1. Choose **Add** (add a bot) and enter the Application ID.
2. Fill in the short and long description and the tags from `posts/discord-listing.md`.
3. Set the prefix to `/` (slash commands only), the invite link to `WORKER_URL/install`, and the website to the Who's Bluffing site.
4. Submit for review. Reviewers add the bot to a test server and try the commands.

Who's Bluffing answers over HTTP and never connects to Discord's gateway, so it shows as offline in member lists while
working normally. Say this in the note to reviewers.

**Discord App Directory.** Listing needs a verified app. Verification opens once the app is in 75 servers and is
required at 100.

1. In the Developer Portal, open **App Verification**. The owner verifies their identity.
2. Request the **Server Members Intent** with this reason: "Shows members' display names on the server's own
   leaderboard. Names are looked up only while drawing it and never stored; answers are kept under salted hashes."
3. Fill in **Terms of Service URL** (`<site>/terms`) and **Privacy Policy URL** (`<site>/privacy`) on General
   Information.
4. Open the **App Directory** page: add the descriptions, tags and screenshots, then enable the listing.

Requirements change over time; check https://discord.com/developers/docs before submitting. PRIVACY.md has no
Discord section yet; one is needed before listing (suggested text in `NOTES.md` and the build report).

## Secrets and vars (exact names)

| Name | Kind | Value |
|---|---|---|
| `DISCORD_PUBLIC_KEY` | secret | General Information → Public Key |
| `DISCORD_BOT_TOKEN` | secret | Bot → Reset Token |
| `SALT` | secret | `openssl rand -hex 32`, set once, never change |
| `BOT_KEY` | secret | the web project's BOT_KEY, sent as `x-bluff-bot` on every API call |
| `DISCORD_APP_ID` | var in `wrangler.toml` | General Information → Application ID (public) |
| `API_BASE` | var in `wrangler.toml` | web origin, e.g. `https://whosbluffing.pages.dev` |

## Deploy and update

```bash
npm test                                       # all tests, mocked Discord and rounds API
npx wrangler deploy --dry-run --outdir dist    # bundle check, uploads nothing
npx wrangler deploy
npx wrangler tail                              # live logs (short error codes only)
```

## Data

Stored in D1:

- The server id, the chosen channel, the post hour, the reveal delay and the roast flag.
- For each daily post: its message id and the day's question as the API served it.
- For each answer: choice and confidence under `sha256(guild_id:user_id:SALT)`, plus points and right/wrong once the
  reveal settles them. The API keeps daily points back until the reveal, so nobody can peek.
- For a `/bluff play` round in progress: the round's questions and the running score.

No member messages, usernames or raw Discord user ids are stored. Display names are fetched from Discord only while a
leaderboard is drawn. The rounds API receives only the hashed member id and a hashed server id
(`discord:` + `sha256(guild_id:SALT)`), never raw Discord ids.

The bot token can post as Who's Bluffing in every server that added it. To rotate it: **Bot** → **Reset Token**, then
`npx wrangler secret put DISCORD_BOT_TOKEN`.

## Limits

- **Names** come from the first 1000 members of a server and need the Server Members Intent. Anyone else shows as
  "a member", and the roast line says "Someone".
- **The daily top 5 lists positive scores only,** so with roast mode off the bluffer cannot be spotted in it.
- **If Who's Bluffing loses access** to the daily channel (deleted, or permissions removed), it stops posting there until
  someone runs `/bluff setup` again.
- **A failed recap** (Discord down at that moment) is not retried that week.
- **Workers free plan:** 10 ms CPU per run. Name lookups hash up to 1000 member ids, so big servers, or many servers
  revealing in the same hour, may need Workers Paid ($5/month).
- **When the web API at `API_BASE` is down,** members see "Who's Bluffing is taking a break, try again in a minute." Posts
  and reveals retry the next hour.
