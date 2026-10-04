# Parity-plus checklist vs truthordarebot.xyz (2026-10-03)

Legend: ✅ have · 🔧 being built (rounds builder) · ➕ to build next (briefs/BRIEF_parity.md) · 👤 needs the owner's account

| Theirs | Ours | Status | Better because |
|---|---|---|---|
| Hero + two CTAs (Add bot / Find other players) | Hero: Play now / Add to Discord / Add to Slack | ✅ | playable in one tap without installing anything |
| Social proof: "thousands of questions, a million communities" | live counters from the KPI job (players, countries, servers + workspaces), shown once ≥ 100 players; "17,000+ questions, every one with a source" | ✅ | numbers are live and defined in a pre-registration |
| Multiple games and modes (4 games × PG/PG13/R) | ranked round, quick round, full assessment, daily chat question, classroom; **packs** (Geography, Space, Elements, History, Buildings, Bridges, Lakes, Rivers, Mountains) × **difficulty** (Easy / Normal / Brutal) | ✅ | modes are about difficulty and topic, not maturity ratings |
| Thousands of questions | 2,074 sourced facts → 17,000+ comparison pairs; players flag bad ones; nightly review | ✅ | every answer links to its source |
| Commands page with search + "commands not working?" | `/commands`: Discord + Slack tabs, search, options, troubleshooting per platform | ✅ | one page for both platforms |
| Premium (custom questions etc.) | everything free; **custom packs** for teams and classes (upload your own facts) | ➕ phase 2 (after launch) | free, and the pack stays private to the room |
| Support: community Discord server | `/community`: Who's Bluffing Discord server (play, support, feedback) + GitHub issues + email | 👤 create the server, ✅ page | same, plus public issue tracker |
| API docs (public questions API) | `/docs/api`: rounds + public read endpoints with CORS and rate limits, open data downloads | ✅ | open data, not just an API |
| GitHub link | repo public on launch day | 👤 flip visibility Mon Oct 5, before the 09:00 ET posts | full source incl. the study |
| Email | hello@whosbluffing.com via Cloudflare Email Routing | 👤 | — |
| Privacy, Terms | ✅ | ✅ | no accounts, no tracking at all |
| Dark/light toggle, mobile layout | ✅ | ✅ | contrast-checked, keyboard-checked |
| Social icons (Discord, Twitter, GitHub) | GitHub ✅, Discord community 👤, X/Bluesky 👤 | ✅ icons wired to constants, 👤 accounts | — |
| Bot listings (top.gg, App Directory) | copy ready in posts/topgg-listing.md, posts/discordbotlist.md (also discords.com), posts/discord-app-directory.md | 👤 top.gg, discordbotlist, discords on Sun Oct 4; App Directory after verification | — |
| Status / changelog / press kit | `/status`, `/changelog` (rendered from CHANGELOG.md), `/press` (logo, screenshots, boilerplate) | ✅ | they have none |
| Find other players | challenge links, daily ranked leaderboard, community server | ✅/👤 | asynchronous play works without a server |

## What they have that we still lack (public-source review, 2026-10-04)

Evidence and dates: `docs/GROWTH_PLAYBOOK.md`. B# = builder task listed there. Rows above are not repeated.

| Theirs (evidence) | Ours today | Next step |
|---|---|---|
| Always-online gateway process: status "Truth or Dare • /help", server count posted to top.gg every 30 min (gateway repo `bot.js`) | HTTP only, shows offline; top.gg rules say "must be online during review" | owner decides by Wed Oct 7: one-line reviewer note first, presence process (B9) on a decline |
| Server count shown on bot lists (top.gg 1,579,429) | nothing posted | B4 after top.gg approval (`TOPGG_TOKEN`) |
| Install callback: a gateway sees every new server | server row only after its first command; silent installs never get a daily post | B2: `APPLICATION_AUTHORIZED` webhook event + welcome line; `USER_TODO.md` D5 already points the portal at `/events`, which the Worker does not route yet |
| Tip line on 8-10% of replies: vote, review, feature tips (`promoMessage()`) | none | B3; free `tips:off` switch (theirs is premium) |
| Link buttons on `/help` and `/invite` (Add · Support · Website); "New Question" buttons under every question | `/bluff invite` replies with plain text | B1; B5 "Add to your server" on reveal + recap |
| Role ping and auto-thread for the scheduled question | channel, hour, roast only | B6 |
| Short links `/invite`, `/support` used everywhere | none | B7, with `?ref=` click counts |
| User-install: works in DMs and group chats (since 2024-03-18) | server installs only | B10, decide Tue Oct 27 |
| `/suggest`: players send question ideas to the support server | flags on wrong answers only | #feedback channel first, command later |
| Support server as a play hub: 22,233 members, Discoverable, onboarding, announcement channel | not created | block B on Sun Oct 4; Community and Onboarding on; Discovery when big enough |
| 285 top.gg reviews, owner replies to reviews | no listing yet | review ask after approval; reply within a day |
| Milestone posts with a thank-you donation; holiday events in the server | none | templates in the playbook; donation optional |
| Public questions API reused widely (634 GitHub code results, Raycast extension) | API documented, little known | attribution line + dev listings, after launch |
| Questions in 7 languages | English only | declined by design |
| Separate 18+ bot to keep the main one all-ages | all-ages content | not needed; an advantage for App Directory review |
