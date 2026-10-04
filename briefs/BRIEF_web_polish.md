# Builder brief — Who's Bluffing? web polish: product-site standard

You are the executor. Repo /Users/ethan/howsure. The bar is https://truthordarebot.xyz/ (a solo developer's product that reached 500K MAU): branded, dark/light, bold hero with social proof, clear CTAs, feature blocks, docs page, support, legal pages, footer with Product / Resources / Legal, mobile-perfect. Our product must look and feel at that level while staying what it is: a research-grade daily game, English only, no accounts, no ads, no third-party scripts or fonts.

Read first: web/public/* (current game, results, share card, class, stats), web/functions/* (daily API, KPI), docs/api-daily.md, PRIVACY.md, prereg/PREREG.md (MAU definition), docs/design-v4-scale.md, slack/README.md and slack/src/game.js (commands and modal), posts/show-hn.md (voice).

Hard rules: no git commands; no deploy/login/purchases; edit only web/ (plus a new root TERMS.md). Keep every test green (web 54+14 unit, 77 smoke; others untouched). No third-party scripts, fonts, analytics or CDNs — vendor anything you need into web/public/vendor with its licence. Plain English; no "first/largest" claims; no mention of AI in copy. Do not change the daily API, the scoring, the schedule, or any data rule. Zero-friction stays: a visitor must be able to start today's game with one tap from `/`.

## Brand and design tokens (write them once in `public/styles.css` as CSS variables; light default, dark via `prefers-color-scheme` and a toggle stored in localStorage)
- Wordmark "Who's Bluffing?" + logo mark: five small rounded squares in a row (🟩🟩🟥🟩🟩 motif) as inline SVG; also `public/favicon.svg`, `public/favicon-32.png`, `public/apple-touch-icon.png` (180), `public/og.png` (1200×630, wordmark + grid + "Who's bluffing?" + whosbluffing.com). Render the PNGs once in Chromium from an HTML template you write under `web/design/`; commit the PNGs.
- Light: --bg #FBFAF7, --surface #FFFFFF, --text #111827, --muted #5B6472, --border #E5E7EB, --accent #2F5BFF, --accent-ink #FFFFFF, --hit #2EAF5B, --miss #E5484D, --focus #FFB020. Dark: --bg #0E1116, --surface #161B22, --text #E6EDF3, --muted #9AA4B2, --border #2A313B, --accent #7A95FF, --accent-ink #0B1020. Verify every text/background pair ≥ 4.5:1 with a node script `web/design/contrast.js` (no deps) and fix tokens until it passes.
- Type: system stack `ui-sans-serif, -apple-system, "Segoe UI", Roboto, Helvetica, Arial, sans-serif`; display 800 weight; scale 44/32/24/18/16/14 on phones, 64/40/28/20/17/15 on ≥ 900 px; line-height 1.2 headings, 1.55 body. Spacing 4 px grid; radius 14 px cards, 999 px pills; shadows subtle; 16 px gutters at 375 px; max content width 1040 px.
- Components: nav (logo, Play, Slack, Teachers, Research, GitHub icon, theme toggle; collapses to a menu button ≤ 760 px), primary/secondary/ghost buttons with inline SVG icons, cards, stat tiles, FAQ disclosure, footer. Visible focus rings; all controls keyboard-reachable; aria labels on icon buttons; `prefers-reduced-motion` respected.

## Pages (all static HTML in web/public, sharing styles.css and a small `site.js` for nav/theme)
1. `/` — compact hero above the fold: h1 "Who's bluffing?", sub "Five numbers a day. Give a range you're 90% sure about. Find out whether your 90% is really 90%.", primary button "Play today's game" (starts the existing game inline, exactly as today), secondary "Add to Slack" (→ /slack). Social-proof strip from `/api/kpi` + `/api/daily/stats`: players, countries, workspaces, today's average — shown only when players ≥ 100; otherwise a single line "A new game every day at 00:00 UTC". Below the game: "How it works" (3 steps), "Three ways to play" (Daily game / Slack / Classroom cards with CTAs), "Open research" (pre-registered hypotheses, open data, GitHub), FAQ (6 items), footer. The game, results and share card keep their behaviour but adopt the tokens and components; grid squares animate in (respect reduced motion).
2. `/slack` — hero "Who's Bluffing? for Slack", "Add to Slack" button (href from one constant `SLACK_INSTALL_URL` in `site.js`, default `https://YOUR-WORKER-HOST/slack/oauth/start`, documented in README), an HTML/CSS illustration of the channel post and the Play modal labelled "illustration", a commands table (`/bluff`, `/bluff setup #channel [HH]`, `/bluff stats`) in the style of the reference site's commands page with a search box, "What we store" bullets from PRIVACY.md, troubleshooting (3 items), FAQ (4).
3. `/teachers` — classroom mode pitch, 3 steps, button to `/class`, privacy bullets (aggregates only, nothing under 5 students).
4. `/research` — the question, the three hypotheses in plain words, "numbers we publish" (MAU definition verbatim from PREREG), open data plan + data card link, pre-registration link (GitHub), how to cite.
5. `/docs/api` — the daily API from docs/api-daily.md rendered as HTML.
6. `/privacy`, `/terms` — rendered from PRIVACY.md and a new root TERMS.md you write (free, non-commercial, as-is, no accounts, acceptable use, data use per privacy policy, contact via GitHub). Write `web/scripts/sync-docs.js` (no deps, ~80 lines: headings, paragraphs, lists, bold, links, inline code) that converts those two markdown files and docs/api-daily.md into `public/privacy.html`, `public/terms.html`, `public/docs/api.html` at `npm run sync-items` time; the generated files are git-ignored like the other synced copies.
7. `/support` — GitHub issues link, FAQ link, what to include in a bug report. `/404.html` branded.
8. Every page: `<title>`, meta description, canonical, OG + Twitter card tags pointing at `/og.png`, favicon links, theme-color; `sitemap.xml` lists all pages; `robots.txt` unchanged in spirit.

## Acceptance (run all; report verbatim)
- `npm test`, `bash test/smoke.sh` green; smoke extended with 200 checks for every new page and `og.png`.
- `node web/design/contrast.js` prints all pairs ≥ 4.5 (or ≥ 3.0 for large display text, listed separately).
- `grep -rniE "googleapis|cdn\.|gtag|analytics|x-forwarded-for|user-agent" web/public web/functions` → nothing.
- Screenshots at 375, 768 and 1280 px, light and dark, for `/`, `/slack`, `/research`, results screen → `web/design/screens/*.png` (commit them; I review visually).
- Keyboard: tab through `/` and `/slack`, every control reachable with a visible ring; the theme toggle has an aria-label and persists.
- No layout shift on load; no horizontal scroll at 375 px.
- README: page map, how to regenerate og/favicons, `SLACK_INSTALL_URL`, the sync-docs step.

## Report back (≤ 25 lines)
Pages built, token contrast results, test summaries, where the screenshots are, deviations in web/NOTES.md, open questions.
