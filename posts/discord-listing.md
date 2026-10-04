# Discord listing: top.gg and the App Directory (submit after the bot has run in your own server for a few days)

Before posting, check two claims: "source published" only once the GitHub repo is public, and "will be released" for
the data (not "is published") until the data is out. Replace {URL} with the site and {INVITE} with
`https://<worker host>/install`.

Name: Who's Bluffing? · Prefix: `/` (slash commands only) · Invite: {INVITE} · Website: {URL} · Support: GitHub issues ·
Privacy policy: {URL}/privacy · Terms: {URL}/terms

## Short description (≤ 120 characters)

One question a day: pick A or B, say how sure you are, and see who in your server is calibrated and who is bluffing.

## Long description (top.gg, Markdown)

**Who's Bluffing is a daily game about how sure you really are.**

Every day Who's Bluffing posts one question in your channel, like "Which is longer: the Nile or the Danube?" Tap **A** or
**B**, then say how sure you are, from 50% ("coin flip") to 100% ("stake it all"). Eight hours later the post turns
into the answer:

- both true values, each with its source
- how your server split: "12 answered · 75% A · 25% B"
- today's top 5
- the bluff of the day: "Someone was 90% sure the Danube is longer. It isn't."

Points reward honest confidence. Saying 50% scores 0. Saying 100% scores +100 if you are right and −300 if you are
wrong. Being sure only pays when you are right.

**Commands**
- `/bluff setup` pick the channel, the hour (UTC) and roast mode (Manage Server)
- `/bluff question` post today's question now
- `/bluff play` a private 10-question round, with a Challenge button to share your score
- `/bluff stats` your server's leaderboard for the last 30 days
- `/bluff reveal` reveal today's answer early (Manage Server)
- `/bluff help` · `/bluff invite`

**Roast mode** is off by default, so the bluffer stays anonymous. Turn it on and the reveal names them.

**Every Monday** brings a short recap: how often your server was right at each confidence level, the most calibrated
member, and the bluff count.

**Privacy.** No messages, no usernames, and no Discord user ids stored with answers. Each member is a salted hash, and
names are looked up only while a leaderboard is drawn. Anonymous answers feed an open study of overconfidence; the
pooled data will be published.

Free, independent, no ads. Source published for transparency.

## App Directory detailed description (shorter)

One question a day in your channel: "Which is longer: the Nile or the Danube?" Tap A or B, then say how sure you are,
from 50% to 100%. Eight hours later the post shows the answer with sources, how your server split, today's top 5,
and the bluff of the day. Points reward honest confidence: 50% scores 0; 100% scores +100 if right and −300 if wrong.
Play a private 10-question round with `/bluff play` and challenge friends. Roast mode, off by default, names the
biggest bluffer. A recap arrives every Monday. No messages, usernames or user ids are stored with answers.

## Tags

top.gg: Game · Fun · Trivia · Leaderboard · Education
App Directory: Games · Entertainment · Education

## Note to reviewers (top.gg)

Who's Bluffing answers over HTTP interactions and does not connect to the gateway, so it shows as offline in member lists.
All commands work. Start with `/bluff setup`, then `/bluff question`, or `/bluff play` for a private round.
