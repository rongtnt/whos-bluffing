# r/SideProject post

From PLACES.md: what I built and why, numbers so far, ask for feedback. Read the sidebar before posting (self-promotion
and flair rules are unverified: automated reading of Reddit was blocked). At most one Reddit post per hour, never the same
text twice. Replace `{URL}` with `https://whosbluffing.com`. Fill the "So far" line from `whosbluffing.com/stats`
(players, servers and workspaces) or delete it; never post a number you have not checked.

## Title options

1. Think you know things? I built a one-minute game that scores how sure you are, not just whether you're right
2. I built Who's Bluffing?, a trivia game where being sure and wrong costs you points
3. My side project: a daily trivia game with a forecasting scoring rule, plus Discord and Slack apps

## Body

I built Who's Bluffing? ({URL}), a one-minute game about knowing what you know.

**What it is.** Ten comparison questions, like "Which is longer: the Nile or the Danube?" You pick one and stake how sure you are, from 50% to 100%. The quadratic scoring rule from forecasting pays for honesty: 50% always scores 0, 100% right is +100, 100% wrong is −300. Each round ends with your type (Bluffer, Hot-headed, Calibrated, Modest or Hedger) and a link that lets a friend play the same ten questions against your score. One ranked round a day, unlimited quick rounds.

**Why.** In calibration studies, answers people call "90% sure" come out right about 70% of the time. I wanted a game that shows you your own number in a minute.

**What's in it.**

- every answer shows its source (the questions are built from Wikidata facts), and players can flag bad ones
- Discord and Slack apps that post one question a day to a channel, then reveal the answer and the day's biggest bluff
- no accounts, no ads; source published on GitHub
- a pre-registered study of whether daily feedback improves calibration; the anonymous data will be released

**Stack.** Cloudflare Pages + Workers + D1, vanilla JS.

**So far:** {N} players and {S} Discord servers and Slack workspaces. *(from /stats; delete this line if you have not checked)*

**Feedback I'd love:** is the scoring clear the moment you start playing, and does the end screen make you want to play again or send the challenge link?
