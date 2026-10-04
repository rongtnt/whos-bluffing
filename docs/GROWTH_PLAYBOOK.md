# Growth playbook: what Truth or Dare Bot did, and what Who's Bluffing does next (2026-10-04)

Scope: how Truth or Dare Bot (truthordarebot.xyz, Discord app id `692045914436796436`) grew, rebuilt from public
sources only, then turned into a 30-day plan for Who's Bluffing starting Monday 2026-10-05.
Sources: the bot's public code (AGPL repo, 387 commits), Wayback Machine copies of its site and its top.gg page,
its live top.gg / Discord App Directory / bot-list pages, the public invite of its support server (read through
Discord's public invite endpoint; nobody joined anything), its team X account, its docs blog, and notes from a 2022
Discord developer panel. No logins. Privacy: product facts only; no personal details about anyone.

Marks: **[V]** verified in a primary source (link given) · **[I]** my inference from verified facts · **[U]** unverified.

## TL;DR in numbers

1. **They did not start from zero.** The app was created 2020-03-24 [V, id timestamp]. It had 23.7K servers in
   Feb 2021 and 157,170 in Jul 2021 [V, top.gg captures] under an original developer who paid "$90/mo over 9 VPSs"
   [V, panel notes]. The team behind the "Oct 2021 – Oct 2024" line took over with a rewrite that began
   2021-09-26 [V, repo], with the bot already above 157K servers. We are at zero; the first 100 servers are our
   whole problem, and they never had it.
2. **Growth was Discord-native, not launch posts.** No Product Hunt, Hacker News, Reddit, Medium or podcast launch was
   found [V, searches; absence]. The team X account has 319 followers; its 1,000,000-servers post got 10K views
   [V, x.com/truthordareteam]. Installs came from bot lists, Discord's own surfaces and buttons inside the bot [I].
3. **Votes were a small lever and they knew it.** Total top.gg votes grew ~700/month (2021-22), then 404, then
   148/month, tracking how often the bot asked (8% of replies → 4% → 2% → ~1% → 0 on 2024-02-07) [V, code +
   captures]. Servers kept growing ~39-57K/month through all of it [V]. Today: 54 votes this month, 1,579,429 servers.
4. **They were early on every Discord feature**: slash commands about 11 months before Discord's message-content
   deadline (Aug 31 2022), native in-app purchases 13 days before Discord announced them publicly (2022-10-04 vs
   2022-10-17), user-installable app support in March 2024 [V, commits; TechCrunch].
5. **They protected discoverability.** In Oct 2022 they moved 18+ questions into a separate bot because an
   age-restricted label "would limit discoverability and usage for the majority of our users, which are under 18"
   [V, docs blog].
6. **Their "question of the day" is a paid feature** ($2.99/month) and started from a user reply on X ("Like it posts
   one every day?", 2022-06-24) [V]. Our daily question is the free core.
7. **They have no SEO question pages.** The site has 7 pages and no sitemap; Wayback shows no question URLs, 2021-2026
   [V]. Search traffic was never their engine [I]. Question pages are open ground for us, not a copy job.
8. **Their public questions API spread the brand**: 634 GitHub code results reference `api.truthordarebot.xyz`, plus a
   Raycast extension with 781 installs [V, GitHub search 2026-10-04; raycast.com].
9. **The support server is a play hub**: "Truth or Dare Community — Play Truth or Dare with people from around the
   world!", 22,233 members, Discoverable in Server Discovery, onboarding on [V, public invite data]. The site's
   second button is "Find Other Players" → that server [V].
10. **They kept an always-online gateway process** even after moving to HTTP: presence "Truth or Dare • /help" and a
    server-count post to top.gg every 30 minutes [V, gateway repo]. top.gg's rules say a bot "must be online during
    review" [V]. Who's Bluffing is HTTP-only and shows offline: **our top risk for the top.gg submission.**

---

## (a) Timeline with evidence

| Date | What happened | Evidence |
|---|---|---|
| 2020-03-24 | Discord app created by an original developer (not named in public sources). | Snowflake of id `692045914436796436` [V] |
| 2020-06-12 | Support server created (guild `721108820339851285`, today "Truth or Dare Community"). | Snowflake of guild id from the public invite [V] |
| 2021-02-07 | top.gg: 23.7K servers, 6 reviews. | [Wayback](https://web.archive.org/web/20210207183614/https://top.gg/bot/692045914436796436) [V] |
| 2021-06-08 | First archived site: a single-page app with only a title, no indexable text. | [Wayback](https://web.archive.org/web/20210608211326/https://truthordarebot.xyz/) [V] |
| 2021-07-27 | top.gg: 157,170 servers, 2,405 votes all-time, 80 reviews (≈24K new servers/month since Feb). | [Wayback](https://web.archive.org/web/20210727142525/https://top.gg/bot/692045914436796436) [V] |
| 2021-09-26 | Team rewrite begins: HTTP interactions + slash commands. Day 3: public questions API with rate limits. | [repo](https://github.com/tandpfun/truth-or-dare) commits `96b43af`, `b935a29` [V] |
| 2021-09 → 10 | "Hard cut to slash commands"; old text commands answered with a new invite; support-server helpdesk with automated FAQ. Cost fell from $90/mo (9 servers) to $3/mo. | [Panel notes](https://gist.github.com/dirquel/cabd8580dfb0aa8c28a8e08d9cf85647) (recording linked there) [V] |
| 2021-10 | X account @truthordareteam opens (Oct 2021). `/suggest` (players submit questions to a support-server webhook), Paranoia, stats posting. | [X profile](https://x.com/truthordareteam); commits `ed20a2f`, `e0c7378` [V] |
| 2021-10-18 → 20 | Premium: one-time $4.99 (1 server) or $12.99 (3 servers) for custom questions, disable default questions, paranoia frequency. | commit `85a7518`; [premium page Dec 2021](https://web.archive.org/web/20211209073624/https://truthordarebot.xyz/premium) [V] |
| 2021-11-02 | Teaser post: "We're getting close to 250,000 servers 👀". | [Wayback](https://web.archive.org/web/20211102222719/https://twitter.com/truthordareteam/status/1455662793101742085) [V] |
| 2021-11-04 | Vote ask added to 8% of question replies: "Enjoying the bot? Consider upvoting me!" (top.gg link). | commit [`38ba9c1`](https://github.com/tandpfun/truth-or-dare/commit/38ba9c1) [V] |
| 2021-11-08 | 250,000 servers; donated $150 to 3 charities to celebrate. | [Wayback](https://web.archive.org/web/20211108040415/https://twitter.com/truthordareteam/status/1457559507622522882) [V] |
| 2021-12 | Site now server-rendered: "Featuring more than 1,500 questions and used in over 250,000 communities", full command table. Holiday giveaways and events in the community server; $50 donation. | [Wayback site](https://web.archive.org/web/20211209080600/https://truthordarebot.xyz/) [V] |
| 2022-04-25 | "New Question" and game buttons under every question ship ("Buttons were helpful for mobile users"). | commit `90b5f7e`; panel notes [V] |
| 2022-05-08 | Tip rotation under questions (8% chance): vote ask + review ask "Share your experience with a review! (at the bottom of the page)". | commit `a4ecf59` [V] |
| 2022-05-20 | 500,000 servers; $200 to charity (≈39K new servers/month since Nov). | [Wayback](https://web.archive.org/web/20220520163952/https://twitter.com/truthordareteam/status/1527690526756962305) [V] |
| 2022-06-03 | Questions in 7 languages; tip line advertises it. | commit `b7bf6f0` [V] |
| 2022-06-24 | Reply to a user: "Interesting idea! Like it posts one every day?" (origin of scheduled questions). | [Wayback](https://web.archive.org/web/20220707055337/https://twitter.com/truthordareteam/status/1540181374853734409) [V] |
| 2022-06-25 | Lead developer speaks on Discord's official Developer Stage "Large Bot Developer Panel", beside Dank Memer's developers. | panel notes; [RT](https://web.archive.org/web/20220705003336/https://twitter.com/truthordareteam/status/1540125791345815552) [V] |
| 2022-06-28 | top.gg: 557,135 servers, 10,137 votes all-time, 226 reviews. | [Wayback](https://web.archive.org/web/20220628083649/https://top.gg/bot/692045914436796436) [V] |
| 2022-07 | Site v2: "used in over half a million communities"; buttons "Add Truth or Dare" + "Find Other Players"; a scrolling wall of sample questions. | [Wayback](https://web.archive.org/web/20220707193612/https://truthordarebot.xyz/) [V] |
| 2022-08-31 | In-bot survey (through the tip line) on moving 18+ questions to a separate bot "to reach a broader audience". | commit `a032d4e` [V] |
| 2022-10-03 → 09 | 18+ questions moved to a separate "Truth or Dare 18+" bot to meet Discord's developer policy. | [docs blog](https://docs.truthordarebot.xyz/blog/removal-of-the-r-rating); [X post](https://x.com/truthordareteam) [V] |
| 2022-10-04 | Discord-native premium ("Upgrade" button on the bot profile). Discord announces the App Directory and premium app subscriptions on 2022-10-17. | commit `5d3414f`; [TechCrunch](https://techcrunch.com/2022/10/17/discord-bots-app-directory-activities/) [V] |
| 2022-12-03 | top.gg: 852,133 servers (≈57K/month since June, their fastest stretch; it overlaps the App Directory launch, causal link [U]). | [Wayback](https://web.archive.org/web/20221203115845/https://top.gg/bot/692045914436796436) [V] |
| 2022-12-17 | Scheduled questions (hourly or daily, optional role ping) released, premium only. | [X post](https://x.com/truthordareteam); PR #26 `438b686` [V] |
| 2023-01 | Premium becomes a subscription: $2.99/mo (1 server), $7.99/mo (3); "No repeated questions" added as a perk. | [premium page Jan 2023](https://web.archive.org/web/20230127144231/https://truthordarebot.xyz/premium) [V] |
| 2023-03-22 | 1,000,000 servers; $250 to charity. | [X post](https://x.com/truthordareteam) (10K views) [V] |
| 2023-12-03 | top.gg: 1,325,189 servers, 14,004 votes all-time, 278 reviews (≈39K/month since March). | [Wayback](https://web.archive.org/web/20231203201445/https://top.gg/bot/692045914436796436) [V] |
| 2024-01-04 | Auto-thread option for scheduled questions. | commit `6780d78` [V] |
| 2024-02-07 | Vote ask removed; tips now 10% "TIP:" lines about features and premium only. | commit `5288f5d` [V] |
| 2024-03-18 | User-install and group-DM support. | commit `a779c6e` [V] |
| 2024-06 → 2025-01 | Discord premium buttons in upsells; question categories; promo codes; $2.99/mo or $29.99/yr. | commits `4df82b4`, `abce0ee`, `89c2ef2`; [premium page Jan 2025](https://web.archive.org/web/20250121051512/https://truthordarebot.xyz/premium) [V] |
| 2025-03-28 | Last public commit. | commit `647ab7c` [V] |
| 2026-10-04 | top.gg: 1,579,429 servers, rating 3.65 from 285 reviews, 54 votes this month (≈7.5K new servers/month since Dec 2023: slowing). App Directory: "in 1.7M servers", In-App Purchases, 5 languages. Support server 22,233 members. | [top.gg](https://top.gg/bot/692045914436796436); [App Directory](https://discord.com/discovery/applications/692045914436796436) [V] |

Growth rate between data points (servers added per month, net): 24K (H1 2021) → 27K → 39K → 45K → **57K** (H2 2022)
→ 41K → 39K (2023) → 7.5K (2024-26). Votes per month between captures: 700 → 404 → 148.

---

## (b) The mechanics, with evidence and how each applies to us

| # | Mechanic | Evidence | Applies to us how |
|---|---|---|---|
| 1 | **Install once, a whole server plays.** One admin click puts the bot in front of every member. | 500K MAU vs 1.5M communities ([portfolio](https://thijs.gg/projects/truth-or-dare)) [V] | Same shape: one `/bluff setup` = a daily post for the whole channel. Count active servers, not installs. |
| 2 | **Being findable where admins look**: top.gg, discordbotlist, discord.bots.gg, App Directory, plus being at the top of in-list search for "truth or dare". | Listings on all four [V]; ranking effect [I] | Submit to top.gg, discordbotlist.com, discords.com in week 1; App Directory once verified (75 servers to apply, 100 required). Our search words: trivia, quiz, daily question, QOTD, chat revive. |
| 3 | **The admin pitch is server activity, not fun facts.** App Directory copy: "DOUBLE YOUR SERVER'S ACTIVITY! ... Some servers have seen server activity double within days". Would You uses "Prepare to see interactions skyrocket". | [App Directory](https://discord.com/discovery/applications/692045914436796436), [Would You](https://top.gg/bot/981649513427111957) [V] | Lead with "gives your server one thing to talk about every day". Never claim numbers we do not have. |
| 4 | **Every reply carries the next action.** `/help` and `/invite` end with three link buttons: Add Truth or Dare · Support · Website. Every question has "New Question" / game buttons. | `src/commands/help.ts`, `invite.ts`, `ButtonHandler.ts` [V] | Our reveal is seen by the whole channel: add an "Add to your server" link button to the reveal and the Monday recap; make `/bluff help` and `/bluff invite` use link buttons. |
| 5 | **Low-frequency tip line.** 8% of replies (10% from 2024) carry one rotating tip: vote, review, languages, scheduled questions, premium. Hidden for premium servers; "You can disable these tips with premium." | `promoMessage()` history in `src/classes/Functions.ts` [V] | Copy the rate (8-10%), not the paywall: tips under the reveal and the `/bluff play` end screen, never on the question post, free off switch (`/bluff setup tips:off`). |
| 6 | **Vote ask without a reward.** "Enjoying the bot? Consider upvoting me!" No vote-reward code in the interactions repo's whole history; the gateway only posts the server count. Votes tracked the ask frequency; growth did not. | commits `38ba9c1`, `5288f5d`; top.gg captures [V] | Ask, no reward, from top.gg approval on. top.gg's "Top" list is sorted by monthly votes and is owned by bots with currency rewards (Mudae 3.14M votes) ([list](https://top.gg/list/top)) [V], so do not chase it; aim for "Trending New Bots" in the first weeks [I]. |
| 7 | **Ask for reviews, answer reviews.** Review ask in the tip rotation; the team replied to reviews ("We've just released an update which should make the bot much more stable!"). 285 reviews, 3.65 average (46 one-star); complaints in the visible reviews: repeated questions, a setting locked behind premium, 18+ confusion, "won't come online". | top.gg page [V] | After approval: review ask in the tip rotation; the owner answers every review within a day. Our "everything is free" answers their top complaints. |
| 8 | **Always online, even on HTTP.** A tiny gateway process (`GUILDS` intent, zero cache) shows presence "Truth or Dare • /help" and posts the server count to top.gg every 30 min. | [gateway repo](https://github.com/Truth-or-Dare-bot/truth-or-dare-gw) `bot.js` [V] | We show offline. top.gg: "Must be online during review" ([guidelines](https://support.top.gg/hc/en-us/articles/23146912808988-Discord-Bot-Guidelines)) [V]. Decision in the plan (day 5). Server-count posting needs no gateway: the hourly Worker can do it. |
| 9 | **Stable and cheap** beat feature-rich: HTTP interactions made the bot "stable" and cut cost to $3/mo; the 2021 reviews complained "It won't come online". | panel notes; top.gg reviews [V] | We are already HTTP on Cloudflare. Keep the reveal reliable; one broken reveal in a new server = an uninstall [I]. |
| 10 | **Early on every Discord surface**: slash commands (Sep 2021), buttons (Apr 2022), native premium (Oct 2022), user apps (Mar 2024). | commits [V] | Next surfaces for us: install webhook events (`APPLICATION_AUTHORIZED`, [docs](https://docs.discord.com/developers/events/webhook-events)) to greet new servers; user-install for `/bluff play` later. |
| 11 | **Keep the main bot all-ages.** 18+ moved to a separate bot to keep discoverability for an audience mostly under 18. | [docs blog](https://docs.truthordarebot.xyz/blog/removal-of-the-r-rating) [V] | Our content is all-ages: an advantage for App Directory review. Keep roast lines all-ages forever. |
| 12 | **Support server = play hub.** "Find Other Players" button → a Discoverable community server, onboarding, welcome screen, announcement channel; set as the app's official support server (shows on the App Directory page with its member count). | invite data (features `DISCOVERABLE`, `GUILD_ONBOARDING`, `NEWS`, `DEVELOPER_SUPPORT_SERVER`) [V] | Our community server runs the daily question itself, so a visitor plays before installing. Structure in (d). |
| 13 | **Players write content.** `/suggest` sends question ideas to a support-server channel. | commit `ed20a2f` [V] | We take flags on wrong answers; add a "suggest a fact" channel in the server first (no code). |
| 14 | **Public API as reach.** Free questions API from day 3; 634 code references on GitHub; Raycast extension. | [API docs](https://docs.truthordarebot.xyz/api-docs); GitHub search; [Raycast](https://www.raycast.com/coding/truth-or-dare) [V] | We publish open data and an API already; add a one-line attribution request and list the API in dev directories later. Low priority in 30 days. |
| 15 | **Milestone ritual**: teaser, then "Today, we reached N servers", thanks, a charity donation with proof ($150 / $200 / $250); holiday giveaways in the server. | X posts [V] | Same rhythm, with our natural extra: one real number from our data in each milestone post. A donation is optional and the owner's call. |
| 16 | **Listen in-product.** Surveys through the tip line (Aug 2022) before a big change. | commit `a032d4e` [V] | Use the tip line once for a one-question feedback form before changing defaults (hour, roast mode). |

What did **not** drive them (useful for us): SEO pages (none), social media (319 followers), launch posts (none
found), paid ads (none found [U]; top.gg sells promoted slots by auction, no sign they used it).

---

## (c) What the team posted, where, when

| When | Where | What | Reach |
|---|---|---|---|
| 2021-11-02 | X @truthordareteam | Teaser: "We're getting close to 250,000 servers 👀 You never know, something cool might happen 😉" | n/a |
| 2021-11-08 | X | "🎉 Today, we reached 250,000 servers on @discord! ... we've donated $150 to 3 organizations" | n/a |
| 2021-12-21 / 26 | X + community server | Holiday giveaways and events in the community server; $50 donation | n/a |
| 2022-01-01 | X | New-year thank-you ("we hope that we've helped you build friendships") | n/a |
| 2022-05-20 | X | "🎉 We've reached 500,000 servers on @discord! ... donated $200 to charity" | n/a |
| 2022-06-25 | Discord Developer Stage (official Discord event) | Lead developer on the large-bot panel: porting to HTTP interactions, onboarding users to slash commands | community recording |
| 2022-10-03 | X + docs blog | Moving 18+ questions to Truth or Dare 18+; reasons and how to add the new bot | 3 replies |
| 2022-12-17 | X | "Want to have Truth or Dare send a hourly or daily question automatically? ... released scheduled questions to premium" | 1.8K views |
| 2022-12-25 | X + community server | $110 of prizes given away in the server; $50 to Crisis Text Line | 3.5K views |
| 2023-01-02 | X | "Let's review 2022" | 6.6K views |
| 2023-03-22 | X | "Today, we hit 1,000,000 servers on @discord! 🎉 ... donated $250 to charity" | 10K views, 17 likes |

The lead developer's portfolio today: "Built Truth or Dare — one of the largest Discord bots used by 1.6 million
communities (~16 million people)" and "500,000 monthly active users ... Every minute, 500 people around the world ask
Truth or Dare bot for a question" [V, [portfolio](https://thijs.gg/projects/truth-or-dare)]. Searches for Product
Hunt, Hacker News, Reddit, Medium, Substack and podcasts found no launch or growth post by the team.

---

## (d) 30-day plan for Who's Bluffing (Mon 2026-10-05 → Tue 2026-11-03)

Fixed dates kept from `docs/LAUNCH_RUNBOOK.md` and `USER_TODO.md`: soft launch **Sat Oct 17**, public posts and repo
public **Tue Oct 20**, r/Professors **Wed Oct 21**, Product Hunt + Slack App Directory **Nov 18** (outside this window).
The Discord bot goes live this week so the top.gg review (about a week) finishes before Oct 20.

**Targets for Nov 3 (planning numbers, not predictions):** 75+ servers (the verification gate), 30+ active servers
(answered on 3+ days in the last 7), top.gg approved with 10+ reviews, community server 100+ members,
10+ Slack workspaces. Truth or Dare has no comparable zero-to-100 data: they inherited 157K servers.

**Keep/kill rule (set now, judged on day 21 and day 30):** a channel stays if it brings 3+ servers that answer on 3+
days in their first week. Clicks per source come from `/invite?ref=<source>` (builder task B7). Installs alone
do not count.

### Day by day

Owner time is the owner's own clicks and posts; "B#" are builder tasks listed below the table.

| Day | Date | Owner (≈30-60 min unless noted) | Builder | Check |
|---|---|---|---|---|
| 1 | Mon 10/05 | Launch-morning checklist (e) blocks A + B: register the Discord app, deploy the Worker, add the bot to your own server, create the community server (≈90 min). | Fill `DISCORD_INSTALL_URL` and `COMMUNITY_INVITE_URL` (via the web builder). | One question posted, answered, revealed (`/bluff reveal`). |
| 2 | Tue 10/06 | Add the bot to 3-5 servers you are in (friends, clubs, class). Message template below. Take 3 real screenshots: question, picker, reveal. | B1 (link buttons on help/invite). | First natural reveal (8 h) in 3+ servers. |
| 3 | Wed 10/07 | Pin the welcome and rules in the community server; post the first #announcements message. | B2 (welcome on install). | No errors in `wrangler tail`. |
| 4 | Thu 10/08 | Block C: submit top.gg, discordbotlist.com, discords.com (copy in `posts/`). | B3 tip line, vote link left blank until approval. | Submissions confirmed by email/page. |
| 5 | Fri 10/09 | Decide the offline risk (see "top risk" below): note only, or a tiny presence process. Outreach batch 1: 10 servers you belong to. | B9 only if you choose a presence process. | Servers ≥ 10. |
| 6 | Sat 10/10 | Play the daily in the community server; answer every question there within 12 h. | — | Answers per active server per day. |
| 7 | Sun 10/11 | Week-1 review: servers, active servers, answers per server-day, reveal views. Write 3 lines in the support server about what changed. | — | Servers ≥ 15 [target]. |
| 8 | Mon 10/12 | Outreach batch 2: 10 trivia, geography, quiz or forecasting servers you can post in (ask their mods first). | B5 "Add to your server" button on reveal + recap. | Click counts by `ref`. |
| 9 | Tue 10/13 | Slack: install in 2 more workspaces you belong to. | B8 brief for question pages (aired questions only). | Slack workspaces ≥ 3. |
| 10 | Wed 10/14 | Read the first top.gg reviewer message if any; fix fast (three declines for the same reason = ban). | B6 role ping + thread options. | — |
| 11 | Thu 10/15 | top.gg decision window opens (review ≈ a week). If approved: grab the vote link and API token (block D). | B4 server-count posting (needs the token). | Listing live? |
| 12 | Fri 10/16 | Runbook T-1: freeze the pre-registration, play tomorrow's game on your phone. | — | `/api/kpi` `as_of` = today. |
| 13 | Sat 10/17 | **Soft launch.** If top.gg has approved (otherwise on the day it does): turn on the vote and review lines in the tip rotation and ask the admins of your 5 most active servers for a review (template below). | — | Reviews ≥ 3. |
| 14 | Sun 10/18 | Buffer. Answer reviews. | — | — |
| 15 | Mon 10/19 | Final copy pass on `posts/`; check every link; schedule nothing you cannot answer live. | B7 short links `/invite`, `/support`. | — |
| 16 | Tue 10/20 | **Launch day (runbook):** repo public; Show HN, r/InternetIsBeautiful, r/samplesize, LessWrong + EA Forum, newsletter emails; X thread (`posts/x-launch-thread.md`). Add the "Source published" line and GitHub link to top.gg and discordbotlist. | — | Reply to every comment for 6 h. |
| 17 | Wed 10/21 | r/Professors + instructor emails (runbook). r/discordbots post (`posts/reddit-discordbots.md`) after reading its rules. | — | Servers from Reddit `ref`. |
| 18 | Thu 10/22 | Fix the top 3 reported problems; post a short "what we fixed" in #announcements. | Fixes. | Uninstalls this week. |
| 19 | Fri 10/23 | Milestone post if you passed 25 or 50 servers (template below), in the community server and on X. | — | — |
| 20 | Sat 10/24 | Community event: "Bluff-off" weekend, best ranked-round score posted in #play wins a shout-out. | — | Community members. |
| 21 | Sun 10/25 | **Keep/kill review #1** with the rule above. Drop channels that brought no active server. | — | Write the decision in this file. |
| 22 | Mon 10/26 | Outreach batch 3: 20 servers, only the kinds that worked. If servers ≥ 75: apply for app verification (block E). | — | Verification submitted? |
| 23 | Tue 10/27 | One-question feedback form through the tip line (one week). | Tip-line variant. | Responses. |
| 24 | Wed 10/28 | Answer reviews; thank servers that hit a 7-day answer streak (Monday recap shows it). | — | — |
| 25 | Thu 10/29 | Decide user-install for `/bluff play` (B10) from the feedback. | — | — |
| 26 | Fri 10/30 | Halloween post in the community server and X with a real, sourced "spooky" fact from the pool (only if one exists; never invent). | — | — |
| 27 | Sat 10/31 | Buffer. | — | — |
| 28 | Sun 11/01 | Month report: numbers only, in the support server and on X; milestone post if 100 servers. | — | — |
| 29 | Mon 11/02 | If verified: enable App Directory discovery (copy in `posts/discord-app-directory.md`). Prepare Nov 18 (Product Hunt + Slack directory). | — | Listed? |
| 30 | Tue 11/03 | **Keep/kill review #2**; set the next 30 days from what brought active servers. | — | — |

Every day: `cd ~/howsure/web && npm run tomorrow` (2 min, the runbook's quality gate); read new reviews and the
community server once.

**Top risk: "offline" at top.gg review.** top.gg requires bots to be "online during review" and the submit form
asks you to confirm it [V/U: the checkbox is reported by a third-party guide]. Who's Bluffing answers over HTTP and
never connects to the gateway, so it shows offline although every command works. Truth or Dare kept a small gateway
process for exactly this. Options: (1) submit with the reviewer note in `posts/topgg-listing.md` (cost: maybe one
decline, and three declines for the same reason bans the account); (2) run a tiny always-on presence process
(`GUILDS` intent, no cache, status "Playing /bluff help") on any always-on host (cost: one small process to keep
alive). My pick: (1) first, switch to (2) on the first decline for "offline". The owner decides on day 5.

### Builder tasks (briefs, not built here)

| ID | Task | Why (evidence) | When |
|---|---|---|---|
| B1 | `/bluff help` and `/bluff invite` reply with link buttons: Add to a server · Community · Website. | ToD `help.ts`, `invite.ts` | before Oct 8 |
| B2 | Subscribe to the `APPLICATION_AUTHORIZED` webhook event: create the install row at once and post one welcome line in the server's system channel if the event's guild data names one [U] ("An admin can type `/bluff setup` to pick the channel, or `/bluff question` to post today's now."). Today a server row only appears after its first command (`discord/src/store.js` line 9), so a silent install never gets a daily post. | [Discord webhook events](https://docs.discord.com/developers/events/webhook-events) | before Oct 8 |
| B3 | Tip line: one rotating line at 8% under the reveal and the `/bluff play` end screen, never on the question post; `/bluff setup tips:off`. Lines are in `posts/topgg-listing.md`. | ToD `promoMessage()` | build now, vote/review lines on at approval |
| B4 | Post the server count to top.gg (and discordbotlist) from the hourly Worker run; secret `TOPGG_TOKEN`. | ToD gateway posts every 30 min | after approval |
| B5 | "Add Who's Bluffing to your server" link button on the reveal post and the Monday recap. | ToD buttons on every reply | week 2 |
| B6 | `/bluff setup ping:@role` and `thread:on` (a thread under each daily post for the discussion). | ToD scheduled-question options | week 2 |
| B7 | Website short links: `/invite?ref=<source>` (count by ref, no personal data, 302 to Discord) and `/support` → community invite. | ToD `/invite`, `/support` | before Oct 20 |
| B8 | Question pages for already-revealed questions only (see SEO ideas). | none at ToD: open ground | week 3-4 |
| B9 | Optional presence process (see top risk). | ToD gateway repo | only if chosen |
| B10 | User-install (`integration_types` 0 and 1) for `/bluff play` in DMs and group chats. | ToD commit `a779c6e` | decide day 25 |

### The vote-incentive mechanic

- **Phase 1 (from top.gg approval):** ask, no reward. One tip-line slot out of six at an 8% tip rate (≈1.3% of
  eligible replies; Truth or Dare's rate was 8% → 1.1%),
  plus a Vote button in `/bluff help` and one line in the Monday recap. Text in `posts/topgg-listing.md`.
  This is what Truth or Dare did; their votes followed the ask rate and never drove growth.
- **Phase 2 (only if `ref=topgg` clicks show votes bring installs):** a top.gg vote webhook marks the voter with a ✓
  next to their name on that server's leaderboard for 12 hours. Never points, never an early reveal, never anything
  that touches scores: the scores are research data. top.gg allows rewards and locking a minority of commands; vote
  reminders must have an opt-out ([voting guidelines](https://support.top.gg/hc/en-us/articles/23146974461596-Voting-Guidelines)).
- **Never:** vote-locking any command, DMs asking for votes, rewards for voting for anything else.

### SEO page ideas (ours, not theirs; they have none)

1. **One page per question that has already been revealed** (never a future daily): `/q/nile-vs-danube`, title
   "Which is longer: the Nile or the Danube?", both values with their source links, the share of players who got it
   right and their average confidence (our unique data), and "How sure would you have been? Play today's question".
   Five related links from the same pack.
2. **Pack hubs**: "River length quiz", "Mountain height quiz", "Which country is bigger?", one per pack, each listing
   its revealed questions.
3. **Intent pages**: "Daily question bot for Discord" (QOTD), "Trivia bot for Discord", "Daily trivia for Slack",
   "Overconfidence test" (`/test`), "Calibration quiz".
4. **Daily archive** `/daily/<date>` after each reveal: yesterday's question, answer, split.
5. **Data pages** that earn links: "How often is 100% sure wrong?" with live numbers once the sample is big enough.
6. Basics: sitemap entries for every page above, one canonical URL each, no indexing of anything unrevealed.

### Support-server structure (Who's Bluffing? Community)

Turn on Community (needed for announcements, welcome screen, onboarding, and later Server Discovery).

| Channel | Type | Topic (paste) |
|---|---|---|
| #welcome | text, read-only | (welcome text in block B) |
| #rules | text, read-only | (rules text in block B) |
| #announcements | announcement | New features, milestones, fixes. Press Follow to get these in your own server. |
| #daily-reveal | text | Today's question lands here at 14:00 UTC. Answer before the reveal. No spoilers. |
| #play | text | Type /bluff play for a private 10-question round. Post your score and challenge someone. |
| #feedback | text | Wrong answer? Post the question and a source link. Ideas and fact suggestions welcome. |
| #help | text | Bot not responding? Tell us the command you ran and what you saw. |

Bot in the server: `/bluff setup channel:#daily-reveal hour:14 roast:off`. Announcement channels can be followed
by other servers, so every update can land in admins' own servers. Later (bigger server): onboarding questions,
then Server Discovery (requirements shown in Server Settings; size threshold [U]).

### The "add to server" funnel

| Step | What happens | Our number to watch | Fix if weak |
|---|---|---|---|
| 1 Discover | top.gg, bot lists, website `/discord`, reveal button, `/bluff invite`, posts | clicks per `ref` (B7) | better listing copy, more tags |
| 2 Authorize | Discord's add screen: 3 permissions, no admin | clicks → servers added | keep permissions minimal (83968) |
| 3 First touch | today: nothing until someone runs a command | servers with a first command within 24 h | B2 welcome line |
| 4 Setup | admin runs `/bluff setup` or `/bluff question` | servers with a daily post | welcome line names the exact command |
| 5 First reveal | 8 h later the post turns into the answer | servers with ≥ 3 answers on day 1 | role ping (B6), better hour |
| 6 Habit | answers on 3+ of the first 7 days | active servers | Monday recap, threads, roast mode |
| 7 Spread | a member adds it elsewhere | installs from reveal/recap buttons | B5 |

### Milestone posts

Milestones: 10, 50, 100 servers (the verification gate), 250, 500, 1,000; same for Slack workspaces; web players
from `/stats`. Rhythm from Truth or Dare: a teaser a few days before, then the post, then a thank-you in the server.

Template (fill only with real numbers):
> 🎉 Who's Bluffing? is now in {N} Discord servers. Across them, people answered {A} daily questions. When someone
> said "100% sure", they were wrong {X}% of the time. Thank you for playing. Add it to yours: {INVITE}

Outreach message for servers you belong to (send to a mod or admin you know, never mass DMs):
> Hi {name}! I made a small free bot for Discord: once a day it posts one question like "Which is longer: the Nile or
> the Danube?" Members pick A or B and say how sure they are; hours later it reveals the answer with sources and the
> day's biggest bluff. Want to try it in one channel? {INVITE} · whosbluffing.com/discord

Review ask for admins of active servers (after top.gg approval):
> Thanks for running Who's Bluffing in {server}! If it's been fun, a short review on top.gg helps other servers find
> it: {TOPGG_URL} (reviews are at the bottom of the page).

---

## (e) Launch-morning checklist (owner's own clicks only)

Start Monday Oct 5 at 08:00 ET (block A can start Sunday). Secrets go into your password manager and `wrangler
secret put`, never into chat. Assets live in `web/public/press/`.

### Block A: Discord app (≈20 min clicks + the README terminal steps)

1. https://discord.com/developers/applications → **New Application** → Name: `Who's Bluffing?` → Create.
2. **General Information**
   - App Icon: upload `web/public/press/icon-512.png`.
   - Description: paste "App description" from `posts/discord-app-directory.md`.
   - Tags: `trivia`, `quiz`, `daily question`, `leaderboard`, `game`.
   - Terms of Service URL: `https://whosbluffing.com/terms`
   - Privacy Policy URL: `https://whosbluffing.com/privacy`
   - Copy **Application ID** and **Public Key** into your password manager.
3. **Bot**: Reset Token → password manager. Public Bot: on. Server Members Intent: on. Save.
4. **Installation**: Guild Install only; Install Link: Discord Provided Link; scopes `applications.commands` + `bot`;
   permissions Send Messages, Embed Links, Read Message History.
5. Terminal: `discord/README.md` steps 4-7 (D1, deploy, secrets, endpoint URL, register the command).
6. **General Information → Interactions Endpoint URL**: `https://<your worker host>/interactions` → Save.
7. Add it to your own server: `https://discord.com/oauth2/authorize?client_id=<APP_ID>&scope=bot+applications.commands&permissions=83968&integration_type=0`
   then run `/bluff setup channel:#general hour:14`, `/bluff question`, `/bluff play`, `/bluff reveal`.
8. Later, when B2 is built: the portal's webhook-events page (name [U]) → URL from the builder → enable `Application Authorized`.

### Block B: community server (≈15 min)

1. Discord → **+** → Create My Own → For a club or community → Name: `Who's Bluffing? Community` → icon
   `web/public/press/icon-512.png`.
2. Create the channels from the table in (d) with the topics given.
3. Server Settings → **Enable Community**: rules channel `#rules`, updates channel `#announcements`.
4. Paste into **#welcome**:
   > **Welcome to Who's Bluffing?** A daily game about how sure you really are.
   > • Every day the bot posts one question in #daily-reveal. Pick A or B, then say how sure you are, from 50% to 100%.
   > • Eight hours later the answer appears with its source, how everyone split, the top 5 and the bluff of the day.
   > • 50% scores 0. 100% scores +100 if you're right and −300 if you're wrong. Being sure only pays when you are right.
   > • Play a private 10-question round any time in #play with `/bluff play`.
   > Add the bot to your own server: {INVITE} · Website: https://whosbluffing.com
5. Paste into **#rules**:
   > 1. Be kind. Roast the answer, not the person.
   > 2. No spoilers: don't post today's answer before the reveal.
   > 3. Think an answer is wrong? Post the question and a source in #feedback.
   > 4. English, please, so everyone can follow.
   > 5. Discord's Terms of Service and Community Guidelines apply.
6. Paste into **#announcements** and publish:
   > Who's Bluffing? is live on Discord. One question a day, a confidence stake, and a reveal of the day's biggest
   > bluff. Add it to your server: {INVITE}. Press **Follow** above to get updates in your own server.
7. Run `/bluff setup channel:#daily-reveal hour:14 roast:off` in the server.
8. Invite people → Edit invite link → Expire after **Never**, Max uses **No limit** → copy → send it to the builder for
   `COMMUNITY_INVITE_URL` (and use it as the support link on every listing).

### Block C: listings (Thu Oct 8, ≈40 min)

0. Open https://whosbluffing.com/privacy and check it shows the "Slack and Discord" paragraph (it is in `PRIVACY.md`;
   the note in `discord/README.md` saying it is missing is out of date). Reviewers read it.
1. **top.gg**: https://top.gg → Login with Discord → Add → Discord Bot → Application ID → fields from
   `posts/topgg-listing.md` (short + long description, tags, invite, website, support, note to reviewers). No
   "Source published" line and no GitHub link until the repo is public on Oct 20. Avatar comes from Discord (the icon
   in block A).
2. **discordbotlist.com**: Login with Discord → Add bot → fields from `posts/discordbotlist.md`.
3. **discords.com**: Login with Discord → add a bot → reuse `posts/discordbotlist.md` (their field names [U]).

### Block D: after top.gg approval (≈10 min)

1. Copy the vote URL (`https://top.gg/bot/<APP_ID>/vote`) to the builder for the tip line (B3).
2. top.gg bot page → Webhooks / API token → copy → `npx wrangler secret put TOPGG_TOKEN` in `discord/` (B4).
3. Reply to every review.

### Block E: gate, not a date (at 75 servers)

1. Developer Portal → **App Verification**: verify your identity; request Server Members Intent with the reason in
   `posts/discord-app-directory.md`.
2. After verification: **Discovery → Discovery Settings**: paste the detailed description, upload screenshots
   (`web/public/press/screen-discord.png`, `screen-home.png`, `screen-question.png`, `screen-result.png`; check the
   portal's current size limits), add the support server and links → enable Discovery (up to 24 h to appear).

---

## Not verified (say so if repeated)

- The exact top.gg submit-form checkbox text ("needs to be online to pass review") comes from a third-party guide.
- Whether App Directory placement caused the H2 2022 speed-up (timing only).
- Who the original 2020 developer is, and the exact handover terms.
- The current exact App Directory eligibility list (Discord shows it in the Developer Portal); "75 to apply,
  100 required" is from `discord/README.md` and secondary sources.
- Field names and limits on discords.com and discordbotlist.com; r/discordbots posting rules (Reddit blocked automated
  reading: read the sidebar before posting).
- The 2021 growth driver (23.7K → 157K servers in 5.6 months) under the original developer: no public account.
