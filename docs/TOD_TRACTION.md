# Truth or Dare Bot: traction evidence and weekly tracking (2026-10-04)

Extends `docs/GROWTH_PLAYBOOK.md` (16 mechanisms, support-server structure, milestone posts). This file adds dated
numbers, four corrections to that pass, and a weekly tracker (`scripts/snapshot-tod.sh`). Sources: Wayback Machine
copies (raw `id_` HTML, numbers read from each page's embedded JSON), live public JSON (Discord, discordbotlist,
fxtwitter), Pullpush (a Reddit archive), web search. No logins. All dates UTC unless marked ET.

Marks: **[V]** read in the linked source · **[I]** my inference · **est.** rounded or estimated · **not found** = searched, nothing.

## Corrections to GROWTH_PLAYBOOK.md

1. **"Slowing to ≈7.5K servers/month since Dec 2023" is not supported.** top.gg's count has read exactly 1,579,429 in
   every capture from 2025-04-21 to 2026-05-16 (6 captures) and still today: it stopped updating at some date between
   2023-12-03 and 2025-04-21 [V]. Discord's own count today is 1,660,000 (rounded) [V]. Real growth after Dec 2023 is
   unknown beyond "≈+335K in 34 months" (1,325,189 → 1.66M, an average of ≈9.8K/month).
2. **They did buy top.gg ads, at least once.** On 2023-01-19 top.gg's homepage showed "Truth or Dare · 917,222 ·
   Promoted · Vote (136)" in the Top Bots row, linked with `?campaign=235-8` [V]. The playbook said "no sign they used it".
3. **The fastest stretch was Oct 15 – Dec 3, 2022, at ≈100K servers/month**, three times the ≈39K baseline, starting two
   days before Discord launched the App Directory (2022-10-17). The playbook's "57K/month in H2 2022" averaged it away.
4. **Votes peaked at ≈1,250/month (Nov 2021 – Jun 2022), not ≈700.** top.gg's all-time counter restarted when the
   listing was re-created on 2021-10-08 (`createdAt` in top.gg's data; owner id changed between the Jul and Oct 2021
   captures) [V], so dividing across that date understates the rate.

---

## A. Timeline of servers and votes

"Votes (month)" = top.gg's votes so far in that calendar month on the capture date. "All-time" = top.gg's total
votes counter. Reviews come from the same page.

| # | Date | Servers | Votes (month) | Votes all-time | Reviews | Source |
|---|---|---|---|---|---|---|
| 1 | 2021-02-07 | 23.7K (est., page rounds) | 29 | not shown | 6 | [top.gg](https://web.archive.org/web/20210207183614/https://top.gg/bot/692045914436796436) |
| 2 | 2021-07-27 | 157,170 | 154 | 2,405 | 80 | [top.gg](https://web.archive.org/web/20210727142525/https://top.gg/bot/692045914436796436) |
| 3 | 2021-10-11 | 222,000 (est., card rounds) | 108 | not shown | — | [top.gg homepage, "Trending New Bots" row](https://web.archive.org/web/20211011054846/https://top.gg/) |
| 4 | 2021-10-28 | 240,319 | 184 | 122 (counter restarted 2021-10-08) | 149 | [top.gg vote page](https://web.archive.org/web/20211028051849/https://top.gg/bot/692045914436796436/vote) |
| 5 | 2021-11-08 | 250,000 (est., milestone post) | — | — | — | [X post](https://x.com/truthordareteam/status/1457559507622522882) |
| 6 | 2022-05-20 | 500,000 (est., milestone post) | — | — | — | [X post](https://x.com/truthordareteam/status/1527690526756962305) |
| 7 | 2022-06-28 | 557,135 | 497 | 10,137 | 226 | [top.gg](https://web.archive.org/web/20220628083649/https://top.gg/bot/692045914436796436) |
| 8 | 2022-09-16 | 659,941 | 160 | 11,217 | 246 | [top.gg](https://web.archive.org/web/20220916222058/https://top.gg/bot/692045914436796436) |
| 9 | 2022-10-02 | 676,106 | 26 | 11,379 | 248 | [top.gg](https://web.archive.org/web/20221002085058/https://top.gg/bot/692045914436796436) |
| 10 | 2022-10-15 | 687,955 | 143 | 11,496 | 251 | [top.gg](https://web.archive.org/web/20221015014503/https://top.gg/bot/692045914436796436) |
| 11 | 2022-12-03 | 852,133 | 21 | 12,235 | 270 | [top.gg](https://web.archive.org/web/20221203115845/https://top.gg/bot/692045914436796436) |
| 12 | 2023-01-19 | 917,222 | 136 | 12,557 | 271 | [top.gg (promoted link)](https://web.archive.org/web/20230119051511/https://top.gg/bot/692045914436796436?campaign=235-8) |
| 13 | 2023-03-22 | 1,000,000 (est., milestone post) | — | — | — | [X account](https://x.com/truthordareteam) (post cited in the playbook; not re-opened) |
| 14 | 2023-12-03 | 1,325,189 | 10 | 14,004 | 278 | [top.gg](https://web.archive.org/web/20231203201445/https://top.gg/bot/692045914436796436) |
| 15 | 2025-04-21 | 1,579,429 (frozen) | 4 | not shown | 284 | [top.gg](https://web.archive.org/web/20250421140316/https://top.gg/bot/692045914436796436) |
| 16 | 2025-09-16 | 1,579,429 (frozen) | 0 | not shown | 284 | [top.gg vote page](https://web.archive.org/web/20250916170926/https://top.gg/bot/692045914436796436/vote) |
| 17 | 2026-03-01 | 1,579,429 (frozen) | 1 | not shown | 285 | [top.gg](https://web.archive.org/web/20260301172919/https://top.gg/bot/692045914436796436) |
| 18 | 2026-03-09 | 1,579,429 (frozen) | 0 | not shown | 285 | [top.gg](https://web.archive.org/web/20260309035352/https://top.gg/bot/692045914436796436) |
| 19 | 2026-05-16 | 1,579,429 (frozen) | 40 | not shown | 285 | [top.gg](https://web.archive.org/web/20260516080302/https://top.gg/bot/692045914436796436) |
| 20 | 2026-10-04 | 1,660,000 (est., Discord rounds) | — | — | — | [Discord App Directory JSON](https://discord.com/api/v9/application-directory-static/applications/692045914436796436?locale=en-US) |
| 21 | 2026-10-04 | 1,660,000 (est.) | 0 upvotes in October (discordbotlist) | — | 1 rating | [discordbotlist JSON](https://discordbotlist.com/api/v1/bots/692045914436796436) |

Rows 16-19: the 2026-03-01 → 2026-03-09 drop (1 → 0) means the month field is not strictly reliable in the new top.gg
data; treat it as approximate. The earlier pass read "54 votes this month" on the live top.gg page on 2026-10-04;
not re-read here (top.gg returns 403 to scripts).

Net growth between top.gg captures (servers/month, 30.4-day months):

| From → to | Days | Servers/month | All-time votes/month |
|---|---|---|---|
| 2021-02-07 → 2021-07-27 | 170 | ≈23.9K (est.) | — |
| 2021-07-27 → 2021-10-28 | 93 | ≈27.2K | counter reset |
| 2021-10-28 → 2022-06-28 | 243 | ≈39.6K | ≈1,250 |
| 2022-06-28 → 2022-09-16 | 80 | ≈39.1K | ≈410 |
| 2022-09-16 → 2022-10-15 | 29 | ≈29.4K | ≈290 |
| **2022-10-15 → 2022-12-03** | 49 | **≈101.9K** | ≈460 |
| 2022-12-03 → 2023-01-19 | 47 | ≈42.1K | ≈210 |
| 2023-01-19 → 2023-12-03 | 318 | ≈39.0K | ≈140 |
| 2023-12-03 → 2026-10-04 | 1,036 | ≈9.8K (est.; Discord rounds to 10K) | not shown |

Reading: servers grew at a near-constant ≈39K/month for two years while top.gg votes fell from ≈1,250 to ≈140 a
month (−89%) [V]. Votes did not drive growth [I]. The one break in the trend is the App Directory launch window [I, timing only].

Other dated counts: support server 22,228 members, 1,095 online on 2026-10-04
([invite JSON](https://discord.com/api/v10/invites/vBERMvVaRt?with_counts=true)); created 2020-06-12
([Discord server page](https://discord.com/servers/truth-or-dare-community-721108820339851285)). Older member counts: not found.
discords.com: no Wayback captures, the live page is JavaScript-only and its API needs a key: not found.
discord.bots.gg: listed 2020-06-12, guild count 0 today (stale) ([JSON](https://discord.bots.gg/api/v1/bots/692045914436796436)).

---

## B. Channels: what each did and what it moved

| Channel | Evidence | What they did, when | Observable effect |
|---|---|---|---|
| **top.gg listing** | captures in A | Listing re-created 2021-10-08 under the new owner; 3 days later it sat in top.gg's homepage "Trending New Bots" row (222,000 servers, 108 votes). Tags: Fun, Social, Game (2021) → Fun, Game, Gaming, Truth-or-dare (Oct 2021) → Truth-or-dare, Fun, Would You Rather, Game, Games, Gaming, 13+, 18+ (Jun 2022 on). Short description since 2022: "Play Truth or Dare, Would you Rather, and Never Have I Ever in your server! Over 3,000 questions. PG and 18+ modes." Reviews 6 → 149 from Feb to Oct 2021; 285 now, average 72.9/100 (score split 46 / 14 / 47 / 66 / 112). | Growth went 27K → 40K/month across the relisting [I]. In a non-Google web search for "truth or dare discord bot", the top.gg page ranks and their own site is not in the top 10 [V, 2026-10-04]. |
| **top.gg paid placement** | [homepage 2023-01-19](https://web.archive.org/web/20230119051401/https://top.gg/) | "Promoted" card in the Top Bots row, campaign 235 slot 8. | Seen in 1 of 225 homepage captures checked (222 weekly samples 2021-06 → 2026-09 showed no promoted card; 3 extra in Jan 2023). Growth that window ≈42K/month vs ≈39K baseline: no visible jump. |
| **top.gg vote ask** | playbook (commits) + A | In-bot ask at 8% of replies from 2021-11-04, cut in steps, removed 2024-02-07. | Votes −89% while server growth held ≈39K/month. |
| **Discord App Directory** | [JSON](https://discord.com/api/v9/application-directory-static/applications/692045914436796436?locale=en-US) | Verified, discoverable, monetized app. Tags dare, friends, fun, game, truth; 5 locales; 5 "popular commands" (/truth first); carousel screenshots; detailed description headed "Play Truth or Dare in your Discord Server!" then "Multiple games and modes!". Native premium shipped 2022-10-04, 13 days before Discord's launch. | Fastest stretch (≈102K/month) began 2022-10-15, the App Directory launched 2022-10-17 [I, timing]. |
| **Support server + Server Discovery** | [server page](https://discord.com/servers/truth-or-dare-community-721108820339851285), invite JSON | "Truth or Dare Community: Play Truth or Dare with people from around the world!" Discoverable; categories Roleplay, Gaming, Bots, Social; "Reasons to join: Chatty games of truth or dare · Fun events and giveaways"; "On special days, we run events where we give out Nitro, Premium, and more". Site button "Find Other Players" and `/support` → `discord.gg/vBERMvVaRt`. | 22,228 members, 1,095 online; history not found. |
| **Giveaways** | server page; X posts (playbook) | Holiday giveaways Dec 2021 and Dec 2022 ($110 of prizes), Nitro/Premium events. | Server-count effect not visible (both Decembers sit inside steady stretches). |
| **X @truthordareteam** | [fxtwitter JSON](https://api.fxtwitter.com/truthordareteam) | Opened 2021-10-18; 46 posts; bio "A @discord bot in over 1,000,000 communities". 250K post: 20 likes, 6 reposts, 8 replies; 500K post: 17 likes, 1 repost, 4 replies; 1M post: 10K views (playbook). | 319 followers after 5 years. No server-count jump near any post. |
| **LinkedIn** | [page](https://www.linkedin.com/company/truth-or-dare-bot) | "A Discord bot connecting millions of communities through the game Truth or Dare." 2-10 employees (3 linked), logo uploaded 2025-06-04 (from the logo URL timestamp); no public posts visible. | 5 followers. Created long after the growth [I]. |
| **Reddit** | [Pullpush](https://api.pullpush.io/reddit/search/comment/?q=truthordarebot) (archive, coverage incomplete) | No post by the team found. Mentions: a 2022-05-30 comment linking their site (score 14); a 2025-12-03 r/GrowYourDiscord bot list (score 3). | None visible. reddit.com itself blocks scripts and this browser. |
| **YouTube / TikTok** | web search | No official channel found. Third-party how-to articles exist (itslinuxfoss, itgeared). | not found |
| **discordbotlist** | [JSON](https://discordbotlist.com/api/v1/bots/692045914436796436) | Listed 2021-10-28 (slug `truth-or-dare-8712`; the `truth-or-dare` slug is a different 7K-server bot). | 0 upvotes in October, 1 rating. |
| **discord.bots.gg / discords.com** | JSON above | bots.gg listed 2020-06-12 by the first owner; description still "Used by over 200,000 communities". discords.com: not found. | none |
| **Premium** | App Directory JSON (`is_monetized`), playbook | One-time 2021 → subscription 2023 → Discord-native SKU. | Revenue channel, not a growth channel [I]. |
| **Partnerships / sponsorships** | site, listings, server page | not found | — |
| **Bot-list advertising** | see paid placement | top.gg only, once seen. | see above |
| **SEO** | [robots/sitemap](https://truthordarebot.xyz/sitemap.xml) (404), [docs sitemap](https://docs.truthordarebot.xyz/sitemap-pages.xml) | Site: 5 nav pages, no sitemap, no question pages. Docs: 5 pages, one blog post (2022-10-04). Their free questions API shows up for "truth or dare api". | "truth or dare questions" top 10 (non-Google engine): no Truth or Dare page; content sites own it. Google itself: not checked. |

---

## C. The ranked answer

| Rank | Mechanism | Evidence | Copy this week (owner minutes) |
|---|---|---|---|
| 1 | **Installs from inside Discord: one admin click puts the bot in front of a whole server, every reply carries "Add" and "New Question" buttons** | Steady ≈39K servers/month for two years while votes −89%, X stuck at 319 followers, no Reddit, no SEO: nothing outside Discord moved with the growth. 500K monthly users vs 1.6M communities (playbook). | Add the bot to 3-5 servers you are in, one message each with the outreach template in the playbook: **30 min**. Builder: B1/B5 buttons (0 min for you). |
| 2 | **Discord's own surfaces, entered the day they opened**: App Directory, native premium, verified badge | ≈102K/month from 2022-10-15, App Directory launched 2022-10-17; native premium 13 days early. | Not listable yet (75-server gate). Check `posts/discord-app-directory.md` against their structure: H1 pitch, a "modes" section, 5 popular commands, 3+ screenshots: **10 min**. |
| 3 | **top.gg listing as the category's search result, plus the "Trending New Bots" debut** | Relisted 2021-10-08 → homepage Trending New Bots on 2021-10-11; growth 27K → 40K/month after; their top.gg page outranks their own site for "truth or dare discord bot". | Submit to top.gg with the category words admins type in the title and short description (trivia, quiz, daily question, QOTD), tags filled, support invite set: **30 min** (`posts/topgg-listing.md`). The "new" row only rewards the first days, so submit once the bot is reviewable, not before. |
| 4 | **Support server as a discoverable play hub** | 22,228 members, Discoverable, indexed public page with categories and "events and giveaways"; "Find Other Players" on the site. | Community on, description "Play Who's Bluffing? with people from around the world", the permanent invite on every listing and the site: **15 min**. Discovery itself needs a bigger server (exact threshold not found). |
| 5 | **Reviews as social proof on the listing** | 6 → 149 reviews from Feb to Oct 2021, asked for in-product; 285 now. | After top.gg approval: ask the admins of your 5 most active servers for a review (template in playbook): **10 min**. |

**Probably irrelevant to their growth:** X (319 followers; milestone posts ≤ 20 likes), LinkedIn (5 followers, made
2025), Reddit (no team posts found), YouTube/TikTok (none found), the docs blog (one post), SEO question pages (none),
top.gg votes (fell 89% with no growth change), discordbotlist and discord.bots.gg (0 upvotes, stale counts), the one
paid top.gg slot seen (no rate change). Milestone posts and giveaways kept the community warm but show no server jump.

---

## D. What to track weekly (Sunday, ≈2 min)

Run `bash scripts/snapshot-tod.sh` → `analysis/traction/YYYY-MM-DD.json` (New York date; re-running the same day
overwrites it).

| Metric | Truth or Dare | Who's Bluffing |
|---|---|---|
| Discord servers | `directory_entry.guild_count` at `https://discord.com/api/v9/application-directory-static/applications/692045914436796436?locale=en-US` | `communities.guilds` at `https://whosbluffing.com/api/kpi`; App Directory URL with id `1556371051439587461` once discoverable |
| Bot-list servers / votes | `https://discordbotlist.com/api/v1/bots/692045914436796436` (`stats.guilds`, `upvotes`); top.gg: open `https://top.gg/bot/692045914436796436` in a browser (scripts get 403) | same discordbotlist URL with our id once listed; top.gg page once approved |
| Community server members | `https://discord.com/api/v10/invites/vBERMvVaRt?with_counts=true` | `https://discord.com/api/v10/invites/V5wcSC7cd?with_counts=true` |
| X followers | `https://api.fxtwitter.com/truthordareteam` | `https://api.fxtwitter.com/whos_bluffing` |
| Players | n/a | `players` at `https://whosbluffing.com/api/round/stats`; `n_sessions`, `n_answers` at `https://whosbluffing.com/api/stats`; `mau`, `dau` at `https://whosbluffing.com/api/kpi` |
| Active servers (our keep/kill number) | n/a | servers answering on 3+ of the last 7 days: not exposed by any public endpoint yet; read from D1 |

First snapshot (2026-10-04 ET, 03:23 UTC Oct 5): ToD 1,660,000 servers (Discord and discordbotlist), 22,228 support-server
members, 319 X followers; top.gg null (403 live; Wayback fallback rate-limited that run). Us: 1 Discord server,
1 Slack workspace, MAU 3, 2 community members, 0 X followers, 0 ranked players for 2026-10-05, not on
discordbotlist or the App Directory yet.

## Gaps

Not found or not checked: support-server member history; X follower history (4 Wayback profile captures exist, not
parsed); site claim history ("over 250,000" → "half a million" → "more than a million communities" today) beyond the
playbook's captures; App Directory listing captures (24 exist, the page is JavaScript-rendered, not parsed); Google
rankings (only a non-Google engine was queried); the exact date top.gg's count froze; frequency of paid top.gg
slots beyond the one sighting.
