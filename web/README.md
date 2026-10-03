# HowSure web test

Free 5-minute bilingual (en/zh) overconfidence test: 12 two-choice questions with a confidence rating, 6 numeric 90% ranges, 2 attention checks. Static frontend (vanilla ES modules, no bundler) on Cloudflare Pages, API in Pages Functions, data in D1. No accounts, no cookies, no third-party scripts, no IP or user-agent storage.

## Run locally (Node 22)

```bash
cd web && npm install        # wrangler is the only (dev) dependency
npm run migrate:local        # creates the local D1 tables
npm run dev                  # copies items, then serves http://127.0.0.1:8788
```

Tests: `npm test` (metrics against `analysis/test_vectors.json` + unit tests) and `bash test/smoke.sh` (fresh local D1, real `wrangler pages dev`, curls every endpoint).

## Deploy (you run these; needs a free Cloudflare account)

```bash
cd web
npx wrangler login
npx wrangler d1 create howsure                        # paste the printed database_id into wrangler.toml
npx wrangler d1 migrations apply howsure --remote
npm run sync-items && npx wrangler pages deploy --project-name howsure
```

`pages deploy` uploads `public/` as it is on disk, so always run `npm run sync-items` first (the item copies are git-ignored). The first deploy creates the Pages project; the D1 binding comes from `wrangler.toml`.

## Editing questions

`items/items.json` (repo root) is the only place to edit questions. `npm run sync-items` validates it and writes `public/items.json` and `functions/_items.json`; never edit those copies.

## Manual checklist (after each deploy)

1. Phone, 375 px wide: landing page, 中文/English toggle, no sideways scrolling on any page.
2. Take the test in English: 20 items; the confidence buttons appear after you pick an answer; progress counts up.
3. On a range item, enter a low end above the high end: one gentle message, then Next goes through.
4. Skip the demographics: results show both headlines, the chart, your ranges with the true answers.
5. Share card: switch Square/Wide, Download, Copy image (desktop Chrome/Safari), Copy link; long-press save works in WeChat.
6. "Take it again in 中文": new questions in Chinese; the second results page has no further re-take button.
7. `/class`: create a code, open the student link on another device; the dashboard says "Waiting for 5 students".
8. After 5 finished tests with that code the dashboard shows the class chart within 10 s; the CSV link downloads totals only.
9. `/stats`: counters and both language curves (refreshes within a minute).
10. `npx wrangler d1 execute howsure --remote --command "SELECT * FROM sessions LIMIT 3"`: no IP address or user agent anywhere.

Deviations from the brief and known limits: `NOTES.md`.
