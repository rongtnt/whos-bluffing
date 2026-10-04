# r/Discord_Bots post (Mon Oct 5, after the X thread; runbook order)

The runbook names r/Discord_Bots. Read its sidebar rules first: automated reading of Reddit was blocked, so its rules on
self-promotion, flair and posting frequency are unverified. If it does not allow promotion, post the same text in
r/discordbots (a separate subreddit) instead. Reply to every comment for the opening hours.
Replace `{INVITE}` with `https://whosbluffing.com/discord` (the page has the Add button).

**Title:** I made a free Discord bot that posts one question a day and scores how sure people are

**Body:**

Hi all. I built Who's Bluffing?, a small bot for a daily question in your server.

How it works:

1. Once a day it posts a question in the channel you pick, like "Which is longer: the Nile or the Danube?"
2. Members tap A or B, then say how sure they are, from 50% to 100%. Answers stay private.
3. Eight hours later the post turns into the reveal: the answer with sources, how the server split, the top 5, and
   the bluff of the day ("Someone was 90% sure the Danube is longer. It isn't.").

The scoring punishes bluffing: 50% scores 0, 100% scores +100 if you're right and −300 if you're wrong. Being sure only
pays when you are right, so the leaderboard ends up showing who actually knows what they know.

Other bits:
- `/bluff play` is a private 10-question round with a Challenge button
- roast mode (off by default) names the day's biggest bluffer
- a short recap every Monday
- slash commands only, three permissions (Send Messages, Embed Links, Read Message History), no admin
- no messages, usernames or user ids stored with answers; free, no ads, source published on GitHub

Setup is two commands: `/bluff setup channel:#general` and `/bluff question`.

Add it: {INVITE}

I'd love feedback on two things: what hour works best for the daily post in your server, and whether roast mode
should stay off by default.

*(If someone asks why it shows offline: it runs on HTTP interactions and never connects to the gateway, so Discord
shows it offline, but every command works.)*
