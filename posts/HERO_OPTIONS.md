# Home hero: three options in the dare voice (proposal only; nothing applied)

**Where it lives.** The home hero is hardcoded in `web/public/index.html` lines 52–53 (`<h1 id="hero-title">` and
`<p class="hero-sub">`); it is not in `en.json`. `en.json` `landing.h1` / `landing.lead` is the `/test` landing
(rendered by `app.js`), a separate page with a calmer research tone; leave it as is. On challenge pages (`/c/...`),
`rounds.js:422` replaces the h1 with "You scored X. Name scored Y." once the challenge is played, so the headline only
shows before that. The `<title>` and meta description are unchanged by all three options.

**Today.** Headline: "Who's bluffing?" · Subline: "Ten questions. Stake how sure you are. The scoring rule knows when
you're bluffing."

**The bar.** Each option has to work three ways: as a dare to a casual player, and as plain, accurate copy for a
teacher deciding whether to use it in class or a researcher checking the method. So every line is a challenge or a
true statement about the scoring, never a claim about other people's results.

## Option A: the name is the dare (smallest change)

- Headline: **Who's bluffing?**
- Subline: **Think you know things? Ten questions, about a minute. Stake how sure you are: being sure only pays when you're right.**

Keeps the brand as the headline; the dare moves into the subline's opening question, and the rest reads as a plain
description to a teacher.

## Option B: the challenge

- Headline: **Think you know? Prove it.**
- Subline: **Ten questions. Stake 50% to 100% on each answer. Honest confidence scores best; a sure miss costs 300 points.**

The boldest. The subline is all mechanics, which is what a researcher looks for. The brand name then appears only in
the header logo above it.

## Option C: the observation

- Headline: **Everyone's sure. Who's right?**
- Subline: **Ten questions, about a minute. Say how sure you are; the scoring rule shows if your confidence matches what you know.**

The calmest dare: a question, not a jab, and the subline says what the game measures, in plain words. The safest choice
if many visitors arrive from the teachers page.

## Pick

A if the name must stay the headline (it is also the search and share title); B for the strongest hook; C if the home
page has to carry the classroom and research visitors as well. All three sublines are longer than today's (84
characters), so check the hero at 375 px wide before applying.
