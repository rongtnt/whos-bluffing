# BRIEF home v2: the home page rebuilt around product mocks, not text (2026-10-05)

Owner's direction: truthordarebot.xyz is the bar for cleanliness: one headline, one or two sentences and one visual
per section; everything else is shown, not told. Our home page has far too much text. Three surfaces (web, Discord,
Slack), no premium. The design must not look machine-made: no glows, no gradient meshes, no particles, no grids;
soft, asymmetric, at most two shapes per band. Reference only; our palette, our shapes, nothing copied.

## Keep working
- Play flow: `#play` and every `[data-play]` button (rounds.js `renderRounds`, `playQuick`); `?pack=&difficulty=` deep
  links (picker.js `initPicker` reads `[data-pack]` chips and `[data-difficulty]` buttons; the chips block between
  `<!-- packs -->` and `<!-- /packs -->` is rewritten by `web/scripts/sync-pages.js`: keep the markers and attributes);
  class codes (`?c=`); theme and sound toggles; header and footer shared with `web/scripts/page.html` (the pages test
  compares them); the CSP in `_headers` (script-src 'self': no inline scripts or styles); strings in `i18n/en.json`.
- Copy register: plain, correct English; no slang; no exclamation marks; "source published", never "open source";
  never first/largest/best; types are Bluffer, Too sure, Spot on, Too modest, Playing it safe; never "calibrated" or
  "calibration" on the home page; no em-dashes.

## Skeleton, top to bottom, with text budgets
1. **Hero.** Left: the mark, H1 "Who's bluffing?" with the accent colour on "bluffing" (a span), one sentence of at most
   16 words: "Ten questions. Stake how sure you are. Being sure only pays when you're right." Buttons: primary "Play
   now" (`#play`, data-play), secondary "Add to Discord" (/discord), tertiary text link "Add to Slack" (/slack).
   Nothing else on the left: no picker, no question count, no proof line.
   Right: the product mock, HTML and CSS only (no screenshots), at most 440px wide, with a small 3-segment switch above
   it: Discord · Slack · Web (default Discord; buttons with `aria-pressed`, keyboard accessible). Each state is a
   chat-style card:
   - Discord: a message card in Discord's layout, both themes: our icon as avatar, "Who's Bluffing" with a "BOT" tag and
     "Today", the bot's real post text from discord/src/game.js ("**Who's Bluffing?** · Which is longer: the Nile or the
     Danube?" and the small line "Tap A or B, then say how sure you are. Answer at 20:00."), two buttons "A · The Nile"
     and "B · The Danube"; under it an ephemeral-style note "Only you can see this · How sure?" with pills 50% to 100%
     and 90% pressed; then one member message from a made-up name ("Maya": "called it."). Strings stay honest to what
     the bot sends.
   - Slack: the same question as a Slack message (bot name with an "APP" tag, section text, two buttons, a context line).
   - Web: the game's question card as on the play screen (A and B cards, the confidence row).
   Motion: every 7 s the Discord mock plays a two-step beat (the A button presses, the 90% pill lights) and resets;
   `prefers-reduced-motion` stops it. No other animation in the hero.
   Background: one large soft disc tinted with `--accent` behind the mock's lower right, bleeding off the viewport, and
   one smaller disc top-left behind the mark. Flat tints with a soft edge (a blurred pseudo-element is fine); they must
   read as discs, not glows. Light: about 6%; dark: about 10%.
2. **The reveal.** Left: H2 "Then the reveal" and at most 30 words: "At reveal time the post shows the answer with its
   source, how the room split, the top five, and the bluff of the day." Right: a second Discord-style card in the
   reveal state using the real strings from discord/src/game.js: the answer with its source line, "12 answered · 75% A ·
   25% B", a top five of made-up first names, and the line "Someone was 90% sure the Danube is longer. It isn't."
   (roast mode is off by default, so the bluffer stays anonymous).
3. **Packs.** Left: the pill cloud IS the real pack chips (`[data-pack]`, markers kept) restyled as large tilted pills in
   six soft tints (rotations between −3° and +3°, staggered), and under them the difficulty segment (`[data-difficulty]`)
   with the one-line `[data-difficulty-line]`. Right: H2 "Pick a pack" and at most 25 words: "Twelve packs, from
   geography to AI, at three difficulties. The link remembers your pick, so you can dare a friend to the same pack."
   A small "Play this pack" button (data-play) sits under the text.
4. **Questions.** Left: H2 with the live count the sync already writes ("19,000 questions, each with a source") and at
   most 20 words. Right: a monospace, terminal-like list of 24 real prompts built at sync time from items/pairs.json
   (famous pairs only, no ai_drama; format "Which is longer: the Nile or the Danube?"), alternating muted and strong
   lines, a slow vertical CSS marquee, static under reduced motion; written into index.html by sync-pages.js between
   `<!-- prompts -->` and `<!-- /prompts -->`.
5. **Get started band.** A slanted pale band (a skewed or clipped pseudo-element, 2° to 3°), centred H2 "Get started",
   one line of at most 20 words: "Play in the browser, or add one question a day to your Discord server or Slack
   workspace." Buttons: Play now (data-play) · Add to Discord · Add to Slack. If `/api/round/stats` reports at least 100
   players today, one small line "N played today" (reuse the threshold logic in home.js; never show numbers under it).
6. **Footer.** Unchanged. No premium anywhere.

Removed from the home page: the live panel (`section.live` and its home.js rendering) moves to /stats as the first
section of that page with the same markup and behaviour; the FAQ moves to /support under "Answers that may help" (keep
a `#faq` anchor there and repoint every `/#faq` link); the "How it works", "Three ways to play" and "Open research"
sections are deleted (their content lives on /discord, /slack, /teachers and /research, which keep their links in the
header and footer).

## Theme and contrast
Light: paper background, discs at about 6% accent, band at about 5%. Dark: 10% and 8%. Run the existing contrast script;
nothing under 4.5:1 for text. Check 375, 768 and 1280 in both themes.

## Deliverables
- Code in web/public (index.html, styles.css, home.js, stats page files, support.html, picker.js only if needed) and
  web/scripts/sync-pages.js (prompt list). `web/scripts/page.html` stays as it is.
- Tests updated in web/test (pages, site, motion, smoke) so `cd web && npm test` and `bash scripts/check.sh` pass.
- Screenshots: web/design/screens/home-v2-{375,768,1280}-{light,dark}.png.
- Do not deploy. Do not commit. Report in at most 15 lines: what changed, test results, anything not done and why.
