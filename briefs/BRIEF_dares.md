# BRIEF the Dare board (2026-10-05)

A public page per named public figure: ten fixed questions about their own company or field, the count of people who
have taken it, the best and average score, and the line "{address}: no score yet" until they take it and post their
result from their own account. The owner wants the sharpest honest lever: every reply to a leader links to their own
dare page, and the page keeps score of their silence. Every number must be real; the copy stays polite; the sting is
in the facts.

## Data
- `dares/dares.json` (hand-edited by the owner): an array of
  `{slug, name, address, org, handle, pack, difficulty, keywords: [..], rival: <slug|null>, issued: "YYYY-MM-DD",
  dare_url: <our X reply URL or null>, status: "open" | "played" | "declined" | "removed",
  their_score: null | {score, url, date}}`.
  Seed it with these twenty (handle, address, org, pack/difficulty, keywords, rival):
  altman (sama, Mr. Altman, OpenAI, ai/brutal, ["OpenAI","ChatGPT","GPT","Sora","o1","o3","Altman"], musk);
  musk (elonmusk, Mr. Musk, xAI, ai/brutal, ["xAI","Grok","Musk","Tesla","SpaceX"], altman);
  brockman (gdb, Mr. Brockman, OpenAI, ai/brutal, OpenAI keywords, karpathy);
  karpathy (karpathy, Mr. Karpathy, OpenAI and Tesla alumnus, ai/brutal, ["OpenAI","Tesla","GPT","Transformer"], brockman);
  lecun (ylecun, Professor LeCun, Meta, ai/brutal, ["Meta","Llama","FAIR","LeCun","Facebook"], marcus);
  hassabis (demishassabis, Sir Demis, Google DeepMind, ai/brutal, ["DeepMind","Gemini","AlphaGo","AlphaFold","Google"], suleyman);
  suleyman (mustafasuleyman, Mr. Suleyman, Microsoft AI, ai/brutal, ["DeepMind","Inflection","Microsoft","Copilot"], hassabis);
  srinivas (AravSrinivas, Mr. Srinivas, Perplexity, ai/brutal, ["Perplexity","Google","OpenAI"], kilpatrick);
  nadella (satyanadella, Mr. Nadella, Microsoft, ai/normal, ["Microsoft","OpenAI","Copilot","GitHub"], pichai);
  pichai (sundarpichai, Mr. Pichai, Google, ai/normal, ["Google","Gemini","DeepMind","Bard"], nadella);
  kilpatrick (OfficialLoganK, Mr. Kilpatrick, Google, ai/brutal, ["Google","Gemini","OpenAI"], srinivas);
  clark (jackclarkSF, Mr. Clark, Anthropic, ai/brutal, ["Anthropic","Claude","OpenAI"], altman);
  dwarkesh (dwarkesh_sp, Mr. Patel, Dwarkesh Podcast, ai/brutal, ["OpenAI","Anthropic","DeepMind","Transformer"], mollick);
  mollick (emollick, Professor Mollick, Wharton, ai/brutal, ["OpenAI","Anthropic","Google","GPT"], dwarkesh);
  marcus (GaryMarcus, Professor Marcus, NYU, ai/brutal, ["OpenAI","GPT","Google","Meta"], lecun);
  graham (paulg, Mr. Graham, Y Combinator, companies/brutal, ["Y Combinator","Airbnb","Stripe","Dropbox","Reddit"], andreessen);
  andreessen (pmarca, Mr. Andreessen, a16z, companies/brutal, ["Netscape","Facebook","Coinbase","Airbnb"], graham);
  naval (naval, Mr. Ravikant, AngelList, companies/normal, ["Twitter","Uber","AngelList"], graham);
  gates (BillGates, Mr. Gates, Microsoft, history/normal, ["Microsoft","Windows"], bezos);
  bezos (JeffBezos, Mr. Bezos, Amazon, companies/normal, ["Amazon","AWS","Blue Origin"], gates).
  Keywords are only hints for the picker below; names and orgs are public facts.
- `web/scripts/build-dares.js`: for each dare picks ten pairs deterministically (seeded by slug) from items/pairs.json
  in that pack and difficulty: at least five pairs where an item name contains one of the keywords (case-insensitive),
  the rest from the same pack; referenced or fact-checked items only; no volatile items; no two pairs sharing an item;
  never the home page example pair (ChatGPT released vs Anthropic founded, p36637); never ai_drama items whose name
  still carries a date. Writes the chosen pair ids into dares.json (`items`) and the compact copy to
  `web/functions/_dares.json`. Fails loudly when a dare cannot be filled. Add it to the sync step
  (web/scripts/sync-items.js calls it or `npm run sync-items` runs both) and a guard line to scripts/check.sh
  (every dare: 10 distinct items, the rules above, status in the enum, their_score only when status is played).

## Rounds
- A dare is a fixed quick round with id `dr-<slug>`, pack and difficulty from dares.json, created on first access from
  `_dares.json` the way ranked rounds are materialised from the schedule. `GET /api/round?round_id=dr-<slug>` returns it;
  answers and completion work exactly as for any quick round (same tables, same anonymity). A completed dare round is
  excluded from the "seen" logic of quick rounds only if that is trivial; otherwise ignore.
- `GET /api/dare/<slug>` → `{slug, name, address, org, status, issued, dare_url, players, best, mean_score,
  mean_overconfidence, their_score, rival: {slug, address, players, mean_score, status} | null, as_of}` for completed
  plays of round `dr-<slug>` (bounded queries on the plays table by round_id; cache 60 s with caches.default).
  `GET /api/dares` → the board: every dare with status != removed, `{slug, name, address, org, status, players,
  mean_score, their_score, issued}` sorted by players descending; cache 60 s.
- Completion of a dare round also returns `rank` (1 + completed plays of that round with a higher score) and
  `players` so the end screen can say "Rank 212 of 3,400 on Mr. Altman's round."

## Pages
- `/dare/<slug>` (a Pages Function rendering HTML from a template the way `/c/:round/:token` does, same header and
  footer as web/scripts/page.html, per-page OG tags): H1 "Ten questions about {org}, written for {address}", one line
  "Same ten for everyone. Being sure only pays when you're right.", the three numbers (people who have taken it, best,
  average), the status line in its own card: "{address}: no score yet" / "{address}: {score}, posted {date}" linking
  their post / "{address} declined", a Play button that starts round `dr-<slug>` and, after completion, shows the end
  screen with the rank line and a share text "I scored {score} on the ten questions written for {name}. {He or she
  per a `pronoun` field in dares.json, default they} hasn't taken it yet. whosbluffing.com/dare/{slug}" (switch to
  "{name} scored {their_score}." once status is played). Under it the rival card: "{rival address}'s round: {players}
  taken, average {mean}; {status line}". At the bottom, the board (link to /dares) and the opt-out line: "Public
  figures only. If your name is here and you would rather it weren't, write to hello@whosbluffing.com and it comes
  off within a day." Our X reply (`dare_url`) is linked as "the dare" when present.
- `/dares`: the board as a table: person, company, people who have taken it, average score, their status (no score
  yet / posted {score} / declined), the dare link; sorted by players; H1 "The dare board", one sentence "Each person
  got ten questions about their own field. Everyone can take the same ten. The board shows who has answered."
- Copy register: plain, correct English, polite, no slang, no exclamation marks, no insults, nothing invented; "no
  score yet" is the only status wording for open dares.

## Boundaries
Two other builders are active: home v2 (index.html, home.js, picker.js, support.html, stats.*, web/scripts/page.html)
and claim-your-lab (round-end.js lab block, labs.*, migration 0008, `/api/round/lab`, `/api/labs`). Do not touch
their files except the smallest hook in rounds.js and round-end.js (rank line and share text for dare rounds) and an
appended `/* dares */ ` block at the end of styles.css. New files are yours: dares/dares.json, web/scripts/build-dares.js,
web/functions/_dares.json, web/functions/dare/[slug].js, web/functions/api/dare/[slug].js, web/functions/api/dares.js,
web/public/dares.html + dares.js (or render /dares as a Function too), tests, docs/api-rounds.md entries, a PRIVACY.md
sentence under Rounds ("A dare round stores the same as any round; the page shows only the named person's public
status"), a dated note at the end of web/NOTES.md. If you need a migration, number it 0009 (0008 is taken by labs).

## Tests and acceptance
Unit: the picker (ten distinct, keyword floor, exclusions, determinism), dare round creation and completion rank,
board sorting, status rendering (open/played/declined/removed). Smoke: `/api/round?round_id=dr-altman`, answer,
complete with rank, `/api/dare/altman`, `/api/dares`, `/dare/altman` HTML 200 with OG tags, `/dares` 200. The pages
test passes for any new static page. `cd web && npm test` and `bash scripts/check.sh` green. Do not deploy, do not
commit. Report in at most 12 lines: files, counts, the API shapes, anything not done and why.
