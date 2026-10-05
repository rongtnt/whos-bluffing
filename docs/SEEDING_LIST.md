# Seeding list: rooms for Who's Bluffing? (researched 2026-10-04)

Goal this week: 1,500 players. The Truth or Dare research (`docs/GROWTH_PLAYBOOK.md`) says installs came from inside
Discord (bot lists, servers where members pull friends in), not from posts. This file lists the rooms. It is a research
list: nothing here was posted, joined, submitted or sent.

## Read this first

1. **The community invite expires.** `https://discord.gg/V5wcSC7cd` returns `"expires_at": "2026-11-03T19:15:57+00:00"`
   (Discord invite API, 2026-10-04). Every listing and message points at it. Before seeding, make a new invite with
   Expire after **Never** and replace it everywhere (playbook block B step 8 asks for this).
2. **Per-room counting is not live.** `https://whosbluffing.com/invite?ref=test` returns 404 (builder task B7). Until it
   ships, the day-14 keep/kill rule cannot be applied per room. Use a different link per room where you can (for example
   `?pack=ai` for AI rooms, the Add link for bot asks) and write down which room got which day.
3. **r/trivia bans self-promotion and outside links.** Its sidebar (Wayback capture 2026-06-13) says "Don't promote your
   external events, sites or apps" and "No offsite links." `posts/PLACES.md` Tier 2 lists r/trivia: drop it.
4. **r/ClaudeAI requires "built with Claude".** Its showcase rule asks posters to "be clear the project was built with
   Claude/Claude Code or specifically for Claude BY YOU" and needs 50+ karma. `posts/ai-humor.md` says nothing may say
   or imply that AI built the game. The owner decides; until then, skip it.
5. **Reddit could not be read directly.** reddit.com is blocked for every tool here (curl 403 "blocked by network
   security", WebFetch refused, both browsers refused). Rule texts in D come from Wayback Machine captures of each
   subreddit's own rules page or sidebar (capture date given), or from the Arctic Shift archive (January 2025 snapshots,
   marked [UNVERIFIED current]). Re-read each sidebar while logged in before posting.
6. **Discord rules are mostly inside the servers.** Discord's member-verification and welcome-screen endpoints need a
   login (401), so a server's #rules channel cannot be read without joining. Where a rule is quoted below it comes from a
   public page (the server's own discovery page text, the owner's website, or official guidelines); otherwise the rule is
   [UNVERIFIED] and the action is "ask a mod first". Member counts are Discord's `approximate_member_count` from the public
   invite endpoint on 2026-10-04 (nobody joined anything).

Links used in the drafts: web round `https://whosbluffing.com`, AI pack `https://whosbluffing.com/?pack=ai` (loads,
200), Discord add `https://discord.com/oauth2/authorize?client_id=1556371051439587461` or the page
`https://whosbluffing.com/discord`, Slack add page `https://whosbluffing.com/slack`, class page
`https://whosbluffing.com/class`. Draft register: plain, correct English, no slang, no hype words, no exclamation
marks, "I made this". Never paste the same text twice; adjust each one after reading the room's rules.

Priority: 1 = do in the first two days; 2 = this week; 3 = only if time is left or a mod says yes.

---

## A. Discord servers (25), ordered by expected yield

Expected yield = fit (calibration or AI pack) × active members × how likely a link or the bot is allowed. AI servers
bring web players this week (AI pack link); forecasting, rationalist and quiz servers are where a mod may install the
bot, which is the recurring engine. Everything was checked on 2026-10-04.

| # | Server | Members | Join link | Action | Pri |
|---|---|---|---|---|---|
| A1 | Hugging Face | 240,845 | https://hf.co/join/discord | share AI-pack link in the project-sharing channel | 1 |
| A2 | Learn AI Together | 102,238 | https://discord.gg/learnaitogether | share AI-pack link in the project-sharing channel | 1 |
| A3 | Manifold Markets | 3,555 | https://discord.com/invite/eHQBNBqXuh | ask a mod: link or bot | 1 |
| A4 | Astral Codex Ten (ACXD) | 7,431 | https://discord.gg/acx | ask a mod: link or bot | 1 |
| A5 | LessWrong | 2,911 | https://discord.gg/eYqZMhm | ask a mod: link or bot | 1 |
| A6 | Metaculus | 1,115 | https://discord.com/invite/7GEKtpnVdJ | ask a mod: link or bot | 1 |
| A7 | Claude (official, Anthropic) | 130,917 | https://www.anthropic.com/discord | AI-pack link in off-topic, only if rules allow | 2 |
| A8 | Kaggle | 396,599 | https://discord.gg/kaggle | AI-pack link where sharing is allowed | 2 |
| A9 | Latent Space | 13,544 | https://discord.com/servers/822583790773862470 | AI-pack link where sharing is allowed | 2 |
| A10 | Singularity Discord (r/singularity) | 3,615 | https://discord.gg/official-r-singularity-discord-server-1057701239426646026 | ask a mod where links fit | 2 |
| A11 | Quizbowl | 4,205 | https://discord.gg/quizbowl | ask a mod to install the bot | 2 |
| A12 | This is Jeopardy! (r/Jeopardy) | 1,877 | https://discord.gg/dxYZCqadvN | ask a mod to install the bot | 2 |
| A13 | qbreader | 1,176 | https://discord.gg/5ue7MucTGQ | ask a mod: link | 2 |
| A14 | The Geography Discord | 8,807 | https://discord.gg/geography | ask a mod to install the bot | 2 |
| A15 | EA Corner | 2,075 | https://discord.gg/3zZMVZH7df | ask a mod: link | 2 |
| A16 | hsquizbowl | 2,134 | https://discord.gg/CSRgz53 | ask a mod to install the bot | 2 |
| A17 | University of Bayes | 976 | https://discord.gg/r3DPu6e44U | ask a mod: link or bot | 2 |
| A18 | Forecasting Dojo | 87 | https://discord.gg/9JFAg2CjGM | ask a mod to install the bot | 2 |
| A19 | Rational Animations | 1,693 | https://discord.gg/Tbf3XtmBRS | ask a mod: link | 3 |
| A20 | Kalshi | 39,538 | https://discord.gg/kalshi | ask a mod: link | 3 |
| A21 | AP Students | 54,050 | https://discord.gg/apstudents | ask a mod: link | 3 |
| A22 | GeoGuessr (official) | 63,877 | https://discord.gg/geoguessr | ask a mod: link | 3 |
| A23 | Indie Hackers (unofficial) | 941 | https://discord.gg/d3R5ynFMgr | post in the intro/startup channel | 3 |
| A24 | OpenAI (official) | 857,654 | https://discord.gg/openai | skip | 3 |
| A25 | Study Together | 1,080,690 | https://discord.gg/study | skip | 3 |

### A1. Hugging Face (priority 1)
- **Members:** 240,845. **Join:** https://hf.co/join/discord (redirects to `discord.com/invite/JfAtkvEtRb`; the
  vanity `discord.gg/hugging-face-879548962464493619` also works).
- **Rule found:** discovery page, owner-written: "share their creations with each other"
  ([discord.com/servers/879548962464493619](https://discord.com/servers/879548962464493619)). HF's course docs show the
  server's sharing channels: "#rl-i-made-this: where you can share your projects and models"
  ([deep RL course](https://huggingface.co/learn/deep-rl-course/en/unit0/discord101)). The general channel name and the
  #rules text are [UNVERIFIED].
- **Action:** share a round link (AI pack) in the server's general project-sharing channel after reading #rules.
- **Draft:**
  > I made a free one-minute quiz about the AI industry: ten two-choice questions on OpenAI, Anthropic, xAI and Google
  > (dates, money and drama), with a stake on how sure you are for each. Being sure only pays when you are right, so
  > the score measures calibration as well as recall. No sign-up: https://whosbluffing.com/?pack=ai. I would welcome
  > corrections.
- **Why 1:** largest AI audience with an owner-stated invitation to share creations; the AI pack is on topic.

### A2. Learn AI Together (priority 1)
- **Members:** 102,238. **Join:** https://discord.gg/learnaitogether (linked from towardsai.com, the owner's site).
- **Rule found:** discovery page, owner-written: "anyone learning or working in the field could come and share their
  projects" ([discord.com/servers/702624558536065165](https://discord.com/servers/702624558536065165)). Channel name
  [UNVERIFIED].
- **Action:** share a round link in the project-sharing channel.
- **Draft:**
  > Sharing a small project I made: Who's Bluffing, a free quiz that scores calibration. You answer ten two-choice
  > questions and stake 50 to 100 percent on each; a confident wrong answer costs three times what a confident right one
  > earns. The new AI pack covers lab founding dates, funding and model releases: https://whosbluffing.com/?pack=ai.
  > Feedback on unclear questions is welcome.
- **Why 1:** big, learner-friendly, and the owner's own description invites project sharing.

### A3. Manifold Markets (priority 1)
- **Members:** 3,555. **Join:** https://discord.com/invite/eHQBNBqXuh (posted by Manifold at
  [manifold.markets/post/quick-link-to-manifold-discord-for](https://manifold.markets/post/quick-link-to-manifold-discord-for);
  never expires). Not the same as the "Manifold" NFT server at `discord.gg/cGgTZZGTeV`.
- **Rule found:** [UNVERIFIED]; no public rules page. The Manifold post names a power-user channel "#dev-and-api".
- **Action:** ask a mod whether a link or the bot fits, then post where they say.
- **Draft:**
  > Hi, I made Who's Bluffing, a free calibration game: ten sourced two-choice questions, a 50 to 100 percent stake on
  > each, and a quadratic scoring rule, so honest confidence scores best. There is also a Discord bot that posts one
  > question a day and reveals the answer hours later. Would a link or the bot be welcome here, and in which channel?
  > https://whosbluffing.com
- **Why 1:** calibration is this community's own scoreboard; members build tools and run their own servers.

### A4. Astral Codex Ten Discord, ACXD (priority 1)
- **Members:** 7,431. **Join:** https://discord.gg/acx (vanity; the same guild is the "Discord server" link in the
  r/slatestarcodex sidebar, `discord.gg/RTKtdut`, Wayback capture 2026-08-21). Fan-run: the owner's Patreon says "I run
  a discord server for a blog" ([patreon.com/ACXD/about](https://www.patreon.com/ACXD/about)).
- **Rule found:** [UNVERIFIED]; the invite lands in a channel named "rules".
- **Action:** ask a mod whether a link or the bot fits.
- **Draft:**
  > Hi, I made a free daily calibration game called Who's Bluffing. Each question is a sourced two-choice comparison;
  > you stake 50 to 100 percent, and a proper scoring rule rewards honest confidence. The anonymous answers feed a
  > pre-registered study on whether daily feedback improves calibration. Is there a channel where sharing it fits?
  > https://whosbluffing.com
- **Why 1:** the largest rationalist chat server found; ACX readers run yearly prediction contests.

### A5. LessWrong Discord (priority 1)
- **Members:** 2,911. **Join:** https://discord.gg/eYqZMhm (the short link `memeware.org/rationaldisco` redirects here;
  never expires). Official status [UNVERIFIED].
- **Rule found:** [UNVERIFIED].
- **Action:** ask a mod; offer critique of the scoring as the hook, not the product.
- **Draft:**
  > Hi, I made Who's Bluffing, a free calibration exercise that takes about a minute: ten sourced two-choice questions,
  > a confidence stake from 50 to 100 percent, and quadratic scoring. A Discord bot can post one question a day in a
  > channel. I would value critique of the scoring and the question pipeline. Where would a link fit here?
  > https://whosbluffing.com
- **Why 1:** best audience for the study framing; feedback here improves the LessWrong post already planned.

### A6. Metaculus (priority 1)
- **Members:** 1,115. **Join:** https://discord.com/invite/7GEKtpnVdJ (guild description "Discussion of the forecasting
  platform https://www.metaculus.com"; never expires).
- **Rule found:** [UNVERIFIED].
- **Action:** ask a mod whether a link or the bot fits.
- **Draft:**
  > Hi, I made a small free calibration game that may interest forecasters: ten two-choice questions with sources, a 50
  > to 100 percent stake on each, and quadratic scoring, so overconfidence costs points. It runs on the web or as a
  > Discord bot that posts one question a day. May I share it here, or is there a better channel?
  > https://whosbluffing.com
- **Why 1:** small but exactly on topic; forecasters are the people most likely to keep a daily calibration habit.

### A7. Claude, official Anthropic server (priority 2)
- **Members:** 130,917. **Join:** https://www.anthropic.com/discord (307 redirect to `discord.com/invite/6PPFFzqPDZ`,
  guild "Claude", vanity `anthropic`).
- **Rule found:** [UNVERIFIED]; no public rules page found.
- **Action:** read #rules; post the AI-pack link only in an off-topic or community channel that allows links; otherwise
  skip.
- **Draft:**
  > For an off-topic channel, if allowed: I made a free quiz with an AI pack on Anthropic, OpenAI, xAI and Google
  > (founding dates, funding, releases, departures). You stake 50 to 100 percent on each answer, and confident mistakes
  > cost the most. No account needed: https://whosbluffing.com/?pack=ai. If a question about Anthropic is out of date,
  > tell me and I will fix it.
- **Why 2:** large and on topic for the AI pack, but an official company server; rules unknown.

### A8. Kaggle (priority 2)
- **Members:** 396,599. **Join:** https://discord.gg/kaggle (vanity; official per its discovery page).
- **Rule found:** discovery page, owner-written: "Join over 14M+ machine learners to share, stress test, and stay
  up-to-date" ([discord.com/servers/kaggle-1101210829807956100](https://discord.com/servers/kaggle-1101210829807956100)).
  This is not a self-promotion rule; #rules is [UNVERIFIED].
- **Action:** read #rules; share the AI-pack link only in a channel that allows sharing.
- **Draft:**
  > I made a free quiz for people who follow the AI industry: ten two-choice questions on OpenAI, Anthropic, xAI and
  > Google, with a stake on how sure you are. Overconfidence costs three times what confidence earns, so it measures
  > calibration as well as knowledge. No account needed: https://whosbluffing.com/?pack=ai. I would like to hear which
  > questions feel wrong.
- **Why 2:** huge reach, but a busy official server where one post sinks fast.

### A9. Latent Space (priority 2)
- **Members:** 13,544 (discovery page). **Join:** Discord discovery page
  https://discord.com/servers/822583790773862470 (no invite code found on latent.space).
- **Rule found:** [UNVERIFIED]; the discovery page lists "we chat about latest ai news" but no sharing rule.
- **Action:** read #rules; share the AI-pack link in a general or off-topic channel if allowed.
- **Draft:**
  > I made a free quiz on AI industry history: which lab was founded first, which model shipped earlier, who raised
  > more. You stake how sure you are on each of ten questions, and confident misses cost the most. It takes about a
  > minute: https://whosbluffing.com/?pack=ai. If you spot a figure that has changed since its source was written, I
  > would like to know.
- **Why 2:** AI engineers who follow the labs' dates and money closely; mid-size and active.

### A10. Singularity Discord, official r/singularity server (priority 2)
- **Members:** 3,615. **Join:** https://discord.gg/official-r-singularity-discord-server-1057701239426646026 (linked in
  the r/accelerate sidebar, Wayback capture 2026-10-03).
- **Rule found:** [UNVERIFIED]; the invite lands in "the-rules". Discovery page: "Stay updated with the latest news,
  trends, and breakthroughs in AI" ([page](https://discord.com/servers/singularity-discord-1057701239426646026)).
- **Action:** ask a mod where links fit. Note that r/singularity itself bans self-promotion (D).
- **Draft:**
  > I made a free quiz with an AI pack: ten two-choice questions about the labs (founding dates, model releases,
  > funding rounds and public disputes), with a stake on how sure you are. Confident wrong answers cost three times what
  > confident right ones earn. https://whosbluffing.com/?pack=ai. Is there a channel where links like this are welcome?
- **Why 2:** AI-news audience; small enough that a mod will answer.

### A11. Quizbowl (priority 2)
- **Members:** 4,205. **Join:** https://discord.gg/quizbowl (vanity named on
  [QBWiki](https://www.qbwiki.com/wiki/The_Discord): "The server has the vanity url 'discord.gg/quizbowl'").
- **Rule found:** [UNVERIFIED]. QBWiki notes quizbowl servers already use bots such as Carl-bot
  ([qbwiki.com/wiki/Discord](https://www.qbwiki.com/wiki/Discord)).
- **Action:** ask a mod to install the bot in an off-topic channel.
- **Draft:**
  > Hi, I made a free Discord bot, Who's Bluffing. Once a day it posts one two-choice question in a channel; players
  > pick an answer and stake 50 to 100 percent, and the reveal hours later shows the source, the split and the most
  > overconfident answer. It needs three permissions. Would you consider trying it in an off-topic channel?
  > https://discord.com/oauth2/authorize?client_id=1556371051439587461
- **Why 2:** the main quiz community on Discord; a daily install here is the playbook's ideal unit.

### A12. This is Jeopardy! Discord (priority 2)
- **Members:** 1,877. **Join:** https://discord.gg/dxYZCqadvN (linked in the r/Jeopardy sidebar, Wayback capture
  2026-08-07; guild description "From the Alex Trebek Stage...").
- **Rule found:** [UNVERIFIED] in-server. The r/Jeopardy sidebar describes it as a server "to discuss their favorite
  players, episodes, new games, and other fun topics".
- **Action:** ask a mod to install the bot in an off-topic or games channel.
- **Draft:**
  > Hi, I made a free Discord bot that posts one trivia comparison a day, such as which river is longer, with the source
  > shown at the reveal. Players also stake how sure they are, so a confident miss costs more than a cautious one, a
  > little like a Daily Double wager. Would you consider it for an off-topic channel? https://whosbluffing.com/discord
- **Why 2:** trivia fans who already think in wagers; the subreddit's own server.

### A13. qbreader (priority 2)
- **Members:** 1,176. **Join:** https://discord.gg/5ue7MucTGQ (linked from qbreader.org, a quizbowl practice tool).
- **Rule found:** [UNVERIFIED].
- **Action:** ask a mod whether a link fits.
- **Draft:**
  > Hi, I made a free quiz that might suit quizbowl players: ten two-choice questions with sources, and you stake how
  > sure you are on each, so it trains you to know when you know. There is also a Discord bot that posts one question a
  > day. Would it be all right to share the link here, or is there a better place? https://whosbluffing.com
- **Why 2:** practice-minded quiz players; small server, so a direct ask is reasonable.

### A14. The Geography Discord (priority 2)
- **Members:** 8,807. **Join:** https://discord.gg/geography (vanity, discoverable).
- **Rule found:** [UNVERIFIED]. Its discovery page says it already runs a quiz bot, Countryvia, for testing "geography
  and flag knowledge" ([discord.com/servers/980864248357982269](https://discord.com/servers/980864248357982269)).
- **Action:** ask a mod to install the bot (geography and rivers packs fit).
- **Draft:**
  > Hi, I made a free Discord bot that posts one comparison question a day, such as which river is longer or which
  > country is bigger, with the source shown at the reveal. Players stake how sure they are, and the reveal names the
  > most overconfident answer. I saw you already run a flag bot; would a daily question like this fit too?
  > https://whosbluffing.com/discord
- **Why 2:** bot-friendly server whose topic matches our biggest packs.

### A15. EA Corner (priority 2)
- **Members:** 2,075. **Join:** https://discord.gg/3zZMVZH7df (listed on [aisafety.com/communities](https://aisafety.com/communities)).
  The r/EffectiveAltruism sidebar points members to "the EA Corner Discord server" (capture 2026-07-27), but its link
  `discord.gg/KxZvkAzGwD` is dead, as is the older `discord.gg/nFsNfaH`.
- **Rule found:** [UNVERIFIED].
- **Action:** ask a mod whether a link fits.
- **Draft:**
  > Hi, I made a free calibration game, Who's Bluffing: sourced two-choice questions, a 50 to 100 percent confidence
  > stake, and a proper scoring rule, so honest confidence scores best. The anonymous answers feed a pre-registered
  > study of whether daily feedback improves calibration. Is there a channel where sharing it would be welcome?
  > https://whosbluffing.com
- **Why 2:** the main EA chat server; calibration is a stated EA skill, but the server is small.

### A16. hsquizbowl (priority 2)
- **Members:** 2,134. **Join:** https://discord.gg/CSRgz53 (QBWiki: "an affiliate server specifically for high school
  students (discord.gg/CSRgz53)").
- **Rule found:** [UNVERIFIED].
- **Action:** ask a mod to install the bot; stress all-ages content.
- **Draft:**
  > Hi, I made a free, all-ages Discord bot called Who's Bluffing. Once a day it posts one two-choice question with a
  > source; players pick an answer and say how sure they are, and the reveal shows who was overconfident. It needs only
  > three permissions and stores no message text. Would you consider it for an off-topic channel?
  > https://whosbluffing.com/discord
- **Why 2:** students who already practise quizzing; a teacher-friendly install.

### A17. University of Bayes (priority 2)
- **Members:** 976. **Join:** https://discord.gg/r3DPu6e44U (listed on aisafety.com/communities).
- **Rule found:** [UNVERIFIED].
- **Action:** ask a mod whether a link or the bot fits.
- **Draft:**
  > Hi, I made a free calibration game that applies a proper scoring rule to everyday facts: ten two-choice questions, a
  > 50 to 100 percent stake on each, and a result that compares your confidence with your hit rate. A Discord bot can
  > run one question a day in a channel. Would this fit here, as a link or as the bot? https://whosbluffing.com
- **Why 2:** a Bayesian-reasoning study group; small, so expect a handful of players and maybe one install.

### A18. Forecasting Dojo (priority 2)
- **Members:** 87. **Join:** https://discord.gg/9JFAg2CjGM (guild description: "A peer accountability group for
  deliberate forecasting practice").
- **Rule found:** [UNVERIFIED].
- **Action:** ask a mod to install the bot as a daily drill.
- **Draft:**
  > Hi, I made a free calibration drill that might suit a forecasting practice group: one sourced two-choice question a
  > day, a 50 to 100 percent stake, quadratic scoring, and a reveal that shows who was overconfident. It runs as a
  > Discord bot in one channel, so the group gets a daily data point. Would you like to try it?
  > https://whosbluffing.com/discord
- **Why 2:** tiny, but the closest fit found; a likely active server for the day-14 keep/kill count.

### A19. Rational Animations (priority 3)
- **Members:** 1,693. **Join:** https://discord.gg/Tbf3XtmBRS (official server of the YouTube channel; listed on
  aisafety.com/communities).
- **Rule found:** [UNVERIFIED].
- **Action:** ask a mod whether a link fits in off-topic.
- **Draft:**
  > Hi, I made a free one-minute calibration game: ten sourced two-choice questions, and you stake how sure you are on
  > each, so overconfidence costs points. There is a history pack and a new AI pack. If links are allowed in an
  > off-topic channel, may I share it there? https://whosbluffing.com
- **Why 3:** good topic fit, small and video-focused.

### A20. Kalshi (priority 3)
- **Members:** 39,538. **Join:** https://discord.gg/kalshi (vanity; description "A community of prediction market
  enthusiasts who trade on Kalshi").
- **Rule found:** [UNVERIFIED].
- **Action:** ask a mod; post only if they agree.
- **Draft:**
  > Hi, I made a free calibration game for people who think in probabilities: ten two-choice questions with sources, a
  > 50 to 100 percent stake on each, and a scoring rule that punishes overconfidence. It involves no money and needs no
  > account. Is there a channel where sharing it is allowed? https://whosbluffing.com
- **Why 3:** probability-minded and large, but a company server focused on trading.

### A21. AP Students (priority 3)
- **Members:** 54,050. **Join:** https://discord.gg/apstudents (vanity; the invite lands in "server-rules").
- **Rule found:** [UNVERIFIED]; discovery page: "share resources/advice with others" (about class help, not promotion)
  ([discord.com/servers/181970867549503489](https://discord.com/servers/181970867549503489)).
- **Action:** ask a mod; a study-break link only if allowed.
- **Draft:**
  > Hi, I made a free quiz that could work as a short study break: one two-choice question a day with a source, where
  > you also say how sure you are, so you learn when your confidence is misplaced. It runs on the web or as a Discord
  > bot. Is there a channel where sharing it is allowed? https://whosbluffing.com
- **Why 3:** large student audience, but a help server where outside links are likely restricted.

### A22. GeoGuessr, official (priority 3)
- **Members:** 63,877. **Join:** https://discord.gg/geoguessr (vanity; "the official server for GeoGuessr").
- **Rule found:** [UNVERIFIED].
- **Action:** ask a mod whether an off-topic link fits.
- **Draft:**
  > Hi, I made a free quiz with geography packs (rivers, mountains, countries): ten two-choice questions with sources,
  > and you stake how sure you are on each. A Discord bot can post one question a day. Is there an off-topic channel
  > where a link like this is allowed? https://whosbluffing.com/?pack=geography
- **Why 3:** strong topic fit, but a game company's server; promotion of other games is probably restricted.

### A23. Indie Hackers, unofficial (priority 3)
- **Members:** 941. **Join:** https://discord.gg/d3R5ynFMgr (from the creator's
  [Indie Hackers post](https://www.indiehackers.com/post/seeking-members-for-a-discord-server-for-finding-founders-work-etc-b117670423), 2025-10-01).
- **Rule found:** the creator's post lists "Introduce yourself or your startup here. Free marketing."
- **Action:** post in the introductions or startup channel.
- **Draft:**
  > Hi, I am the maker of Who's Bluffing, a free daily calibration quiz with a web game, a Discord bot and a Slack app.
  > It launched this week. If you try a round, I would like to hear what would make you come back the next day.
  > https://whosbluffing.com
- **Why 3:** self-promotion is explicitly welcome, but the audience is founders, not players. Buildspace, the other
  named example, has closed ("hi. this was buildspace." on buildspace.so).

### A24. OpenAI, official (skip)
- **Members:** 857,654. **Join:** https://discord.gg/openai.
- **Rule found:** OpenAI's community guidelines "apply to all OpenAI online spaces and channels" and list as not allowed:
  "Promote or advertise services unrelated to OpenAI products, developer work, or the category's purpose"
  ([community.openai.com/faq](https://community.openai.com/faq)).
- **Action:** skip. The quiz is not built on OpenAI products.
- **Draft:** none.
- **Why skip:** biggest AI server, but its written rule excludes unrelated promotion.

### A25. Study Together (skip)
- **Members:** 1,080,690. **Join:** https://discord.gg/study.
- **Rule found:** [UNVERIFIED]; the invite lands in "online-safety".
- **Action:** skip unless a mod invites it. A quiz link is off-topic for a focus server.
- **Draft:** none.
- **Why skip:** size without fit; members come to study quietly.

Checked and not included: EleutherAI (39,630; research-only), Nous Research (142,353), Mistral (39,589; product
server), Mathematics (347,654), World History (27,291), Polymarket (106,216; not discoverable, rules unknown),
Bayesian Conspiracy (1,459), MLSpace (invite expired), Studify (14 members). Dead invites: `nFsNfaH` (old EA Corner),
`ypw7PGf` (old SSC), `8rbEq2K` (r/rational), `duHMAGp` (r/learnmachinelearning), `rchatgpt` (r/ChatGPT).

---

## B. Slack communities (10), ordered by expected yield

Verified by a research sub-agent on 2026-10-04 (Slack invite pages were read in a browser pane; no form was filled).
I re-checked the DataTalks.Club and dbt rules pages myself. Member counts are as each community states them.

| # | Community | Members (stated) | Join | Channel | Pri |
|---|---|---|---|---|---|
| B1 | DataTalks.Club | [UNVERIFIED] ("thousands") | https://datatalks.club/slack.html | #shameless-promotion | 1 |
| B2 | MLOps Community | "90,000+" / "over 85,000" | https://go.mlops.community/slack | #be-shameless | 1 |
| B3 | Mind the Product | "60,000+" | https://www.mindtheproduct.com/product-management-slack-community/ | #feedback | 2 |
| B4 | Product School | "over 100,000" | https://productschool.com/slack-community | #11_product-launches | 2 |
| B5 | dbt Community | "100,000+" | https://www.getdbt.com/community/join-the-community | #vendor-content | 2 |
| B6 | LangChain Community | [UNVERIFIED] | https://www.langchain.com/join-community | #vendor-content | 2 |
| B7 | SmarterX AI Community | "over 10,000" | https://smarterx.ai/community | [UNVERIFIED] | 2 |
| B8 | Locally Optimistic | [UNVERIFIED] | https://locallyoptimistic.com/community/ | #vendor-content | 3 |
| B9 | Rands Leadership Slack | "over 30k" | https://randsinrepose.com/welcome-to-rands-leadership-slack/ | none named | 3 |
| B10 | DSLC (Data Science Learning Community) | "23,371 other members" | https://dslc.io/join | [UNVERIFIED] | 3 |

### B1. DataTalks.Club (priority 1)
- **Join:** email form at https://datatalks.club/slack.html, then an emailed invite. Active: events listed for 06 Oct
  and 02 Nov 2026.
- **Rule found:** "Promoting your work is welcome for both companies and individuals."
  ([promotion guidelines](https://datatalks.club/docs/general/guidelines/promotion/)). Posts in shameless channels must
  follow a template (what it is, who it is for, why it is relevant, link); at most two promo posts a week; content must
  relate to data science, ML or data engineering; the #welcome intro must not be a pitch.
- **Action:** post in #shameless-promotion using their template.
- **Draft:**
  > What: Who's Bluffing, a free daily calibration quiz I made (web, Slack app, Discord bot). Who it is for: data people
  > who estimate for a living. Why relevant: it applies a proper scoring rule to two-choice questions, and the anonymous
  > answers feed a pre-registered study of calibration. Link: https://whosbluffing.com (AI pack:
  > https://whosbluffing.com/?pack=ai)
- **Why 1:** the clearest written permission found, a named channel, and a data audience that likes scoring rules.

### B2. MLOps Community (priority 1)
- **Join:** https://go.mlops.community/slack (email-first form). Active: blog post dated 2026-09-29.
- **Rule found:** "Feel free to promote yourself or your company as shamelessly as you want in the #be-shameless
  channel" ([rules](https://mlops.notion.site/MLOps-Community-Rules-0c69be943d0f4efa9e7863414fefc250)). Bare links are
  discouraged ("lazy posts"); no promo DMs.
- **Action:** post in #be-shameless with context.
- **Draft:**
  > I made a free quiz with an AI pack: ten two-choice questions on OpenAI, Anthropic, xAI and Google (release dates,
  > funding, departures), with a stake on how sure you are for each. A proper scoring rule makes confident misses cost
  > the most. There is also a Slack app that posts one question a day to a channel. https://whosbluffing.com/?pack=ai
- **Why 1:** large AI audience and an explicit self-promotion channel.

### B3. Mind the Product (priority 2)
- **Join:** "Get Invited" email form on the community page. Active: articles dated 22-24 Sept 2026.
- **Rule found:** "Feel free to post in #feedback if you'd like some feedback about your product." Also: "Don't post
  anything that specifically promotes a product" (same page).
- **Action:** post in #feedback as a genuine feedback request, not a launch.
- **Draft:**
  > Looking for product feedback: I made Who's Bluffing, a free daily calibration quiz, also available as a Slack app
  > that posts one question a day to a channel. My open question is retention: what would make a team keep answering
  > after the first week? A round takes a minute: https://whosbluffing.com. Critical answers are the most useful.
- **Why 2:** big PM audience and a sanctioned channel, but only for feedback framing.

### B4. Product School (priority 2)
- **Join:** "Join today" email form. Active: ProductCon San Francisco on 2026-10-07 listed.
- **Rule found:** channel name only: the join page lists "#11_product-launches" among its channels. No written promo
  policy found (code of conduct is general).
- **Action:** post in #11_product-launches.
- **Draft:**
  > Launched this week: Who's Bluffing, a free daily calibration quiz I made. Ten two-choice questions, a 50 to 100
  > percent stake on each, and a scoring rule that punishes overconfidence. There is a Slack app that posts one question
  > a day to a channel, with a reveal later. https://whosbluffing.com. Feedback on the onboarding is welcome.
- **Why 2:** a launch channel exists, but its rules are unwritten.

### B5. dbt Community (priority 2)
- **Join:** HubSpot form at https://www.getdbt.com/community/join-the-community.
- **Rule found:** "there are several areas available on the Community Slack for vendors to share promotional material"
  (#vendor-content, #events, #tools-*) ([rules of the road](https://docs.getdbt.com/community/resources/community-rules-of-the-road)).
  Anything with a sign-up call to action counts as promotional; put your company in your display name.
- **Action:** post in #vendor-content.
- **Draft:**
  > Sharing a free side project, since it touches estimation: Who's Bluffing is a daily calibration quiz with a Slack
  > app that posts one two-choice question to a channel and reveals the answer later with its source. Being sure only
  > pays when you are right. No sign-up or tracking. https://whosbluffing.com/slack
- **Why 2:** huge data audience with a sanctioned channel, but vendor channels get little attention.

### B6. LangChain Community (priority 2)
- **Join:** application-style form via https://www.langchain.com/join-community (name, title, company, email, city).
- **Rule found:** "Vendors must keep promotional content within designated areas." (#vendor-content, #events,
  #survey-corner). Open-source maintainers count as vendors "(whether they have a paid offering or not)".
- **Action:** post in #vendor-content.
- **Draft:**
  > I made Who's Bluffing, a free quiz with an AI pack on OpenAI, Anthropic, xAI and Google (founding dates, releases,
  > funding), scored with a proper scoring rule so overconfidence costs points. It is a side project, not a LangChain
  > product. https://whosbluffing.com/?pack=ai
- **Why 2:** AI developers and a designated area; the form asks for work details.

### B7. SmarterX AI Community (priority 2)
- **Join:** request form; "email you an invitation… within 48 hours". Active: MAICON 2026, Oct 13-15.
- **Rule found:** stated purpose, not a rule: "Share advice, resources, and technology tools." Channel [UNVERIFIED].
  The only Slack found whose page names educators in its audience.
- **Action:** after joining, ask where tools are shared; lead with the classroom page.
- **Draft:**
  > For educators here: I made a free classroom tool that measures overconfidence. Students answer two-choice questions
  > and say how sure they are; the class page shows a live calibration curve. There is also an AI pack on the labs'
  > history for a lighter start. No accounts: https://whosbluffing.com/class. I would like to hear from anyone who tries
  > it with a class.
- **Why 2:** the educator angle, which no other verified Slack offers.

### B8. Locally Optimistic (priority 3)
- **Join:** email the admins ("tell us a little bit about yourself"); manual invites. Newest blog post 2025-08-18.
- **Rule found:** listed as not appropriate: "Promote your own product outside #vendor-content or your specific #tools-
  channel unless a community member has asked" ([community page](https://locallyoptimistic.com/community/)).
- **Action:** post in #vendor-content.
- **Draft:**
  > Sharing a free side project in the right channel: Who's Bluffing, a daily calibration quiz with a Slack app. One
  > two-choice question a day, a stake from 50 to 100 percent, and a reveal with the source and the team's split. It is
  > a small way for a data team to practice estimation together. https://whosbluffing.com/slack
- **Why 3:** good audience, slow manual join, weakest recency.

### B9. Rands Leadership Slack (priority 3)
- **Join:** manual email application with a public profile link.
- **Rule found:** "commercial activities such as recruiting, lead generation, marketing, and other solicitation are
  prohibited except in channels dedicated to that purpose" ([code of conduct](https://raw.githubusercontent.com/randsleadershipslack/documents-and-resources/master/code-of-conduct.md));
  also "Ask permission from the channel before posting a message that might be considered commercial".
- **Action:** ask permission in a relevant channel first.
- **Draft:**
  > Before posting anything that might read as promotion, I want to ask: is it all right to share a free,
  > non-commercial Slack app I made? It posts one estimation question a day to a channel and shows the team's
  > calibration at the reveal. If it is not a fit here, that is fine.
- **Why 3:** managers who install team rituals, but the community is strict about anything commercial.

### B10. DSLC, Data Science Learning Community (priority 3)
- **Join:** open invite at https://dslc.io/join (Slack shows "DSLC Admin and 23,371 other members").
- **Rule found:** [UNVERIFIED]; dslc.io says "We encourage learners to share their work with the Community", which
  refers to learner projects, not tools.
- **Action:** ask in a general channel whether sharing a free quiz fits.
- **Draft:**
  > Hi, I made a free quiz that measures calibration: two-choice questions with sources, a stake from 50 to 100 percent,
  > and a proper scoring rule. It might be a light exercise for a learning group. Is there a channel where sharing a
  > tool like this is welcome? https://whosbluffing.com
- **Why 3:** open to join and sizable, but no permission found.

Backups (joining verified, sharing rule unverified): Cerebral Valley (AI builders, open invite at
https://cerebralvalley.ai/slack, "5,304 other members"), Data Visualization Society ("14,000+ practitioners", free
tier at https://datavisualizationsociety.org/join-slack/). Rejected after checking: Measure (bans "Shamelessly promoting
your products or services"), TWIML (bans self-promotion), Superpath (paid), Online Geniuses (paid), Women in Product
(domain parked), Indie Worldwide (unreachable), Teaching in Higher Ed (404), Product Coalition (no Slack), MicroConf
Connect ("pitch-free"), Data Mesh Learning ("vendor-neutral"). No educator Slack could be fully verified.

---

## C. Directories and bot lists (10), ordered by expected installs

Checked by a research sub-agent on 2026-10-04 (every page fetched; no logins or submissions); I re-checked
botlist.me's rules and discordbotlist.com's new-bots page myself. Rule texts sit behind each site's login, so several
were read from the site's own form code and are paraphrased, not quoted. "Live in 2026" means a dated 2026 listing,
changelog or terms page, not just a page that loads. top.gg is excluded (already in progress). Every submission needs the
owner's Discord (or Slack) login; none needs money.

**The offline problem decides most of this list.** The bot is HTTP-only and shows offline. discords.com (a staff
rejection reason is "offline during testing"), botlist.me ("online 24/7"), and Discord Extreme List ("online most of the
time") all require presence. The playbook's option (2), a tiny always-on presence process (builder task B9), removes the
risk at all of them and at top.gg.

| # | Directory | Platform | Submit at | Key requirements | Review time | Live in 2026 (evidence) |
|---|---|---|---|---|---|---|
| C1 | discordbotlist.com | Discord | https://discordbotlist.com/bots/add (Discord login) | "We have no approval queue" (form text); own the bot; a help command or alias; no NSFW; does not answer other bots; short description 32-191 chars, long 100-16,384; no online or server-count rule found | none: no queue | /new lists bots added 2026-10-04 (StudyGarden, 0 votes) |
| C2 | discordlist.gg (dlist.gg) | Discord | https://discordlist.gg/bot/new (Discord login) | up to 10 tags; brief description 25+ chars, detailed 300+; no published listing rules; has a Fun > Trivia category | [UNVERIFIED]; a bot created 2026-10-04 appeared under Newest the same evening | listings created 2026-10-03 and 2026-10-04 |
| C3 | Discord App Directory (official) | Discord | Developer Portal → App Verification, then Discovery → Enable Discovery | team owner's identity and app verification (Stripe identity check; required to grow past 100 servers); public Privacy Policy and Terms links; 13+ content; full checklist only inside the portal | up to 24 h to appear after enabling; verification time [UNVERIFIED] | content policy article updated about 2026-09-09 |
| C4 | Void Bots (voidbots.net) | Discord | https://voidbots.net/me/add (Discord login) | [UNVERIFIED] (no public listing rules) | [UNVERIFIED] | a bot page reads "Added Sep 26, 2026" |
| C5 | discordbots.net (where Disforge's bot list moved) | Discord | https://discordbots.net/bot/add (Discord login; disforge.com/bot/add redirects here; disforge.com itself is now servers only) | [UNVERIFIED]; terms (Nov 2023) ban only illegal, hateful, sexual or malware content; listings show a "Bumped" timer | [UNVERIFIED] | newest bot "Bumped 42 Minutes ago" on 2026-10-04 |
| C6 | vCodes (vcodes.xyz) | Discord | https://www.vcodes.xyz/bot/add (Discord login) | [UNVERIFIED]; listed bots show "Status Offline", so offline bots do get listed | [UNVERIFIED] | listing created 2026-09-11 |
| C7 | Radarcord (radarcord.net) | Discord | https://radarcord.net/submit (Discord login) | [UNVERIFIED]; "No ads" | [UNVERIFIED] | Newest row includes a bot whose account was created 2026-06-18 |
| C8 | dsc.bot (beta) | Discord | https://nightly.dsc.bot/new (Discord login, asks for email) | public bot with its legal links set; owned by the submitting account or team; only needed permissions; no online rule found | [UNVERIFIED] | terms effective 2026-09-13; a bot listed 2026-09-06 |
| C9 | discords.com/bots (ex botsfordiscord) | Discord | https://discords.com/bots/add (Discord login) | short description up to 200 chars, long 300+, up to 5 tags; bots without a posted server count are left off the front page; staff rejection reasons include offline during testing and descriptions linking to competing sites "like top.gg"; terms say users must be 18+ | [UNVERIFIED]; the "recently approved" row showed only 2021-2023 bots | terms updated 2026-02-24; monthly-vote row active on 2026-10-04 |
| C10 | Slack Marketplace (official) | Slack | app settings at https://api.slack.com/apps → "Submit to the Slack Marketplace" | at least 10 active workspaces (used in the last 28 days) or submission is refused; public landing and support pages (replies within 2 business days); privacy policy covering collection, use and retention; no posting to #general by default | preliminary feedback within 10 business days; functional review up to 10 weeks for new apps | Slack docs changelog entry dated 2026-09-15 |

What to do with it, in order:
1. **C1 discordbotlist.com today.** No queue, no online rule; fields are ready in `posts/discordbotlist.md`. Enter `/` as
   the prefix; `/bluff help` should satisfy the help-command rule (my reading, not confirmed by the site).
2. **C2 discordlist.gg and C8 dsc.bot this week** (5 minutes each, no online rule found). C4-C7 only if time is left:
   rules unknown and audiences small.
3. **C9 discords.com: wait for B9 (presence) or expect a decline.** The playbook plans it for Sunday; this evidence says
   the offline status is a stated rejection reason. Keep top.gg links out of its description.
4. **C3 App Directory at the verification gate** (playbook block E), **C10 Slack Marketplace after 10 active
   workspaces.** With a review of up to 10 weeks, the playbook's November submission means a listing around January at
   the earliest; it brings nothing this week.

Also live but blocked by an online rule: Discord Extreme List (https://discordextremelist.xyz/en-US/bots/submit; "online
most of the time"; no automatic messages unless an admin turns them on) and botlist.me (https://botlist.me/add; "The bot
must be online 24/7 other than for maintanence and update purposes" and "Must have at least 5 commands that aren't
generic commands"). Live but negligible: discord.place (top bot has 6 votes), appsforslack.com (30 apps, paid listing).
Dead or no new listings: discord.bots.gg (newest bot added 2025-09-08; 75% weekly uptime rule), bots.ondiscord.xyz
(newest bots from 2020), infinitybots.gg (now an unrelated demo page), wumpus.store, discord.boats, radarbotdirectory.xyz,
discordservices.net, slackhunt (no DNS), botlist.co (redirects elsewhere).

---

## D. Subreddits (10), ordered by expected yield

Beyond the planned r/WebGames, r/SideProject, r/IMadeThis, r/InternetIsBeautiful, r/samplesize and r/Discord_Bots.

**How the rules were verified.** reddit.com blocks every tool available here, so each rule below was read from a
Wayback Machine capture of the subreddit's own rules page (`old.reddit.com/r/<sub>/about/rules`) or its sidebar, with
the capture date given. Two entries rely on the Arctic Shift archive's January 2025 snapshot and are marked
[UNVERIFIED current]. Read the live rules while logged in before posting; a rule can change after its capture.

**How the best time was measured.** From the Arctic Shift archive (posts with their score as re-read about 36 hours after
posting), for each subreddit: which New York weekday and which 3-hour block most often produced a post in that
subreddit's top 10% by score. "18% vs 10%" means 18% of posts made in that slot reached the top 10%, against 10% overall.
n is the number of posts in the slot. This is a weak signal: one slot out of eight will look best by chance, so treat
anything under about 1.3x the base rate as "no clear best time". Whatever the slot, stay online for 2 hours after posting
to answer comments.

**Write these posts yourself.** r/slatestarcodex ("Your comments and posts should be written by you, not by LLMs") and
r/LocalLLaMA ("Completely/primarily LLM generated copy, code is not allowed") ban AI-written posts. The angles below are
notes, not paste-ready text.

| # | Subreddit | Size (source, date) | Path the rules allow | Best slot (ET) | Pri |
|---|---|---|---|---|---|
| D1 | r/ChatGPT | 11,655,316 members (widget, 2026-10-01) | AI-related text post; else the pinned weekly self-promo thread | PENDING | 1 |
| D2 | r/OpenAI | 811,046 weekly visitors (header, 2026-10-01) | text post with context, after some participation | PENDING | 1 |
| D3 | r/ArtificialInteligence | 644,429 weekly visitors (header, 2026-09-25) | post with standalone value, flair Project/Build | PENDING | 1 |
| D4 | r/slatestarcodex | 6.3 posts/day (Apr-Sep 2026) | self-written post with a submission statement | Tue, 12pm-3pm | 1 |
| D5 | r/Jeopardy | 10.0 posts/day (Apr-Sep 2026) | modmail first; post only with explicit permission | Sat, 12pm-3pm | 2 |
| D6 | r/learnmachinelearning | 134,496 weekly visitors (header, 2026-07-05) | share your work, at most once a week | PENDING | 2 |
| D7 | r/accelerate | 344,585 weekly visitors (header, 2026-10-03) | on-topic AI post with context | PENDING | 2 |
| D8 | r/LocalLLaMA | 827,176 members (widget, 2026-09-18) | 1-in-10 self-promotion, affiliation disclosed, LLM topic | PENDING | 2 |
| D9 | r/EffectiveAltruism | 3.3 posts/day (Apr-Sep 2026) | promotion only with an argument for effectiveness | Thu, 12pm-3pm | 2 |
| D10 | r/artificial | 266,955 weekly visitors (header, 2026-09-18) | modmail first; promo at most 10% of your activity | PENDING | 3 |

"Widget" = the related-communities box on another subreddit's captured page; "header" = Reddit's weekly-visitors count
on the subreddit's own captured page.

### D1. r/ChatGPT (priority 1)
- **Rule** (rules page, capture 2026-07-25): "Posts must be directly related to ChatGPT or the topic of AI." Posts focused
  on advertising another LLM service go to the "weekly self-promotional mega thread, which is pinned".
- **Best slot:** PENDING.
- **Angle:** a text post built around one AI-pack question people get wrong with confidence (for example the same-day
  launch of Claude and GPT-4 on 14 March 2023, from `posts/ai-humor.md`), the link in the body. If removed, use the
  pinned weekly thread.

### D2. r/OpenAI (priority 1)
- **Rule** (rules page, capture 2026-07-28; same text in the sidebar on 2026-10-01): "Self-promotional direct link posts
  to projects are not allowed." For your own project, "context must be provided in a text post". Also: "We want
  participation first for you to advertise."
- **Best slot:** PENDING.
- **Angle:** a text post on what the AI pack covers (OpenAI's founding, the capped-profit change, o1 to o3 skipping o2)
  and how the scoring works. Comment in the subreddit for a few days first.

### D3. r/ArtificialInteligence (priority 1)
- **Rule** (rules page, capture 2026-07-28; same in the sidebar on 2026-09-25): "Posts must provide standalone
  educational or technical value that exists independently of any linked project." Use the "Project/Build" flair; "lead
  generation, waitlists, or repetitive self-promotion" bring a permanent ban.
- **Best slot:** PENDING.
- **Angle:** explain why a proper scoring rule makes honest confidence the best strategy, with three AI-pack questions
  written out in the post; the link goes last.

### D4. r/slatestarcodex (priority 1)
- **Rule** (sidebar, capture 2026-08-21): "This is not the place for Substack self-promotion." Substack posts from
  non-members "will be closely scrutinized." Also: "Provide a submission statement for any external link with a
  non-descriptive title."
- **Best slot:** Tuesday (14% vs 10%, n=171); block 12pm-3pm (16% vs 10%, n=192). The 12am-3am block scored 18% (n=87)
  but is a worse time to be awake for replies. Window: 182 days, 1,155 posts.
- **Angle:** the research question (does daily feedback improve calibration?), the pre-registration and the H3
  survivorship check; ask for critique. Write it yourself.

### D5. r/Jeopardy (priority 2)
- **Rule** (sidebar, capture 2026-08-07): for posts linking outside, "and the material is yours, please message the
  moderators first, via the subreddit modmail, before posting." "Permission must have been explicitly granted before the
  post is permitted." The same rule offers help: "we can provide you with further context and assistance before
  posting."
- **Best slot:** Saturday (15% vs 10%, n=197); block 12pm-3pm (14% vs 10%, n=234). Window: 182 days, 1,822 posts.
  Saturdays also carry no new episode, so no game-day spoiler threads compete.
- **Angle:** the confidence stake as a Daily Double for every question; modmail first with the link and a one-line
  description.

### D6. r/learnmachinelearning (priority 2)
- **Rule** (rules page, capture 2026-06-12): "Share your content at most once per week" and "Do share your works and
  achievements, but do not spam." No referral links or paid courses.
- **Best slot:** PENDING.
- **Angle:** calibration is the same idea people measure in classifiers (a proper scoring rule, 50% scores 0); show the
  formula and the AI pack link.

### D7. r/accelerate (priority 2)
- **Rule** (sidebar, capture 2026-10-03): "Users who post irrelevant or substantially similar content, or posts without
  context, are banned." AI or tech progress "must be the primary topic". No separate self-promotion rule appeared in the
  captured sidebar.
- **Best slot:** PENDING.
- **Angle:** the AI pack as a test of how well people know the race (launch dates, parameter counts, funding), with
  context in the post. Keep the lab jokes out and the tone neutral: the sub bans anti-AI ("decel") posters.

### D8. r/LocalLLaMA (priority 2)
- **Rule** (rules page, capture 2026-08-07): "The 1/10th rule is a good guideline: self-promotion should not be more
  than 10% of your content." "Affiliation must be disclosed". Posts "must be related to Llama or the topic of LLMs."
- **Best slot:** PENDING.
- **Angle:** the `ai_params` and `ai_tech` questions (published parameter counts, context windows, training tokens),
  which are on topic here. Say plainly that you made it. Write it yourself.

### D9. r/EffectiveAltruism (priority 2)
- **Rule** (sidebar, capture 2026-07-27): "No promotion without argument." When promoting a project or app, "you must
  provide a clear argument for its effectiveness."
- **Best slot:** Thursday (16% vs 11%, n=90); block 12pm-3pm (14% vs 11%, n=105). Window: 182 days, 595 posts.
- **Angle:** the argument: calibration matters for forecasting and grantmaking, the study tests Lichtenstein and
  Fischhoff's 1980 question (does calibration training work?), and the data and pre-registration are open.

### D10. r/artificial (priority 3)
- **Rule** (rules page, capture 2026-08-28): "Your first post or comment cannot have promo, that would be 100%
  self-promo" and "Any questions or confusion you need to Modmail us first before posting."
- **Best slot:** PENDING.
- **Angle:** only after taking part in discussions; modmail the link first.

Reserve: r/quizbowl (3,892 subscribers, Arctic Shift 2025-02-14; 0.5 posts/day). No self-promotion rule, but "Posts and
comments should stay on-topic to quizbowl the activity" [UNVERIFIED current, January 2025 snapshot]. Angle: the neg
penalty is already a confidence price; the quiz trains the same judgment. Best slot: Tuesday (n=13), 3pm-6pm (n=17); too
few posts to trust.

Rejected after reading the rules:

| Subreddit | Rule that rules it out (source, date) |
|---|---|
| r/trivia | "Don't promote your external events, sites or apps" (sidebar, 2026-06-13) |
| r/singularity | "Self-Promotion/Advertisement posts will not be tolerated." (rules page, 2026-08-28) |
| r/ClaudeAI | showcase posts must say the project was "built with Claude/Claude Code or specifically for Claude BY YOU"; 50+ karma (rules page, 2026-08-23); conflicts with `posts/ai-humor.md` |
| r/GeminiAI | "If it's not built on google somehow then it should not be allowed generally." (rules page, 2026-07-27) |
| r/PredictionMarkets | "No Advertising." (sidebar, 2026-02-22); also small: 2,111 weekly visitors |
| r/forecasting | effectively inactive: 4 posts in the 182 days to 2026-09-30 (Arctic Shift) |
| r/BetterOffline | "No self promotion" [UNVERIFIED current, Jan 2025 snapshot] |
| r/Futurology | "No spamming - this includes polls, surveys, and self-promotion." [UNVERIFIED current, Jan 2025] |
| r/Kalshi | "No spam or self promotion." [UNVERIFIED current, Jan 2025] |
| r/MachineLearning | beginner projects "should be posted to /r/LearnMachineLearning" [UNVERIFIED current, Jan 2025] |
| r/geography | quizzes and games only in "the stickied monthly threads" [UNVERIFIED current, Jan 2025] (allowed there, low reach) |
| r/datascience | "Use the Weekly Thread" and the 1-in-10 self-promotion rule [UNVERIFIED current, Jan 2025] (allowed there, low reach) |
