# top.gg listing (submit Sun Oct 4 during soft setup; review takes about a week)

Paste-ready. Replace `<APP_ID>` (Developer Portal → General Information) and `{COMMUNITY_INVITE}` (block B in
`docs/GROWTH_PLAYBOOK.md`). Before submitting, run one full cycle in your own server (question, answers,
`/bluff reveal`): reviewers try the commands.
Claims that must stay true: "source published" (the repo is public from Mon Oct 5 morning); the data "will be
released", never "is published", until it is out. Never "open source", "first" or "largest"; no mention of AI.

## Fields

- Prefix: `/`
- Invite link: `https://discord.com/oauth2/authorize?client_id=<APP_ID>&scope=bot+applications.commands&permissions=83968&integration_type=0`
  (the Worker's `https://whosbluffing-discord.rongaijun41.workers.dev/install` redirects to the same page)
- Website: `https://whosbluffing.com/discord`
- Support server: `{COMMUNITY_INVITE}`
- GitHub: `https://github.com/ethanrong/whos-bluffing` (use `rongtnt` instead of `ethanrong` if you skipped the
  username change in `USER_TODO.md` B1)
- Privacy policy: `https://whosbluffing.com/privacy` · Terms: `https://whosbluffing.com/terms` (if the form asks)
- Tags (pick the closest ones offered): Trivia · Quiz · Game · Fun · Leaderboard · Education · Social · Chat Revive

## Short description (99 characters)

One question a day. Pick A or B, say how sure you are, and find out who in your server is bluffing.

## Long description (Markdown)

**One question a day that gets your server talking.**

Every day Who's Bluffing posts one question in a channel you choose, like **"Which is longer: the Nile or the Danube?"**

1. Tap **A** or **B**.
2. Say how sure you are, from 50% ("coin flip") to 100% ("stake it all"). Only you see your answer.
3. Eight hours later the post turns into the reveal:
   - the answer, with a source for each number
   - how your server split: "12 answered · 75% A · 25% B"
   - today's top 5
   - the bluff of the day: "Someone was 90% sure the Danube is longer. It isn't."

**Bluffing costs points.** Saying 50% scores 0. Saying 100% scores +100 if you are right and −300 if you are wrong.
Being sure only pays when you are right.

**Commands**
- `/bluff setup` pick the channel, the hour (UTC) and roast mode (needs Manage Server)
- `/bluff question` post today's question now
- `/bluff play` a private 10-question round, with a Challenge button to share your score
- `/bluff stats` your server's leaderboard for the last 30 days
- `/bluff reveal` show today's answer early (needs Manage Server)
- `/bluff help` · `/bluff invite`

**Roast mode** is off by default, so the bluffer stays anonymous. Turn it on and the reveal names them.

**Every Monday** a short recap: how often your server was right when it felt sure, the member whose confidence
matched their results best, and how many bluffs there were.

**Ready in one minute.** Add the bot, type `/bluff setup channel:#general`, then `/bluff question`.

**Privacy.** No messages, no usernames and no Discord user ids are stored with answers. Each member is a salted hash,
and names are looked up only while a leaderboard is drawn. The anonymous answers feed a public study of
overconfidence; the pooled data will be released.

Free, independent, no ads, no accounts. Three permissions only: Send Messages, Embed Links, Read Message History.
Source published on GitHub for transparency. Bugs and ideas: our community server or GitHub issues.

## Note to reviewers (one line, paste this)

HTTP-only bot: it never connects to the gateway, so it shows no online status or presence, but every command works. Type `/bluff help` in any text channel for an instant reply, then `/bluff play` for a private round.

## Longer note (only if the field has room)

Who's Bluffing answers over HTTP interactions and does not connect to the gateway, so it shows as offline in member
lists. All commands work. Start with `/bluff help`, then `/bluff setup channel:#<any text channel>` and
`/bluff question`, or `/bluff play` for a private round. `/bluff setup` and `/bluff reveal` need Manage Server;
everything else works for any member. Questions: `{COMMUNITY_INVITE}`.

## Vote and review asks (only after approval)

No rewards. Never lock a command behind a vote, never DM anyone for votes (top.gg voting guidelines).

1. **Tip line** (builder task B3): one rotating line under the reveal and the `/bluff play` end screen, shown 8% of
   the time, never on the question post; an admin can turn tips off with `/bluff setup tips:off`. The six lines:
   - `⬆️ Enjoying Who's Bluffing? A vote on top.gg helps other servers find it: https://top.gg/bot/<APP_ID>/vote`
   - `⭐ Having fun? A short review on top.gg helps a lot: https://top.gg/bot/<APP_ID> (reviews are at the bottom of the page)`
   - `🎯 Tip: /bluff play is a private 10-question round. Finish it and challenge a friend.`
   - `🔥 Tip: an admin can turn on roast mode with /bluff setup roast:on to name the day's biggest bluffer.`
   - `➕ Tip: add Who's Bluffing to another server with /bluff invite.`
   - `💬 Tip: think an answer is wrong? Tell us in the community server: {COMMUNITY_INVITE}`
2. **`/bluff help`**: a "Vote" link button next to Add to a server · Community · Website.
3. **Monday recap**, last line: `Like Who's Bluffing? Vote for it on top.gg: https://top.gg/bot/<APP_ID>/vote`
4. **Community server**, pinned in #announcements:
   `Vote for Who's Bluffing on top.gg (you can vote every 12 hours): https://top.gg/bot/<APP_ID>/vote. Votes help new servers find the bot. No rewards, just thanks.`
5. **Review ask** to admins of your most active servers: text in `docs/GROWTH_PLAYBOOK.md` → Milestone posts.
