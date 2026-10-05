# X week 1: @whos_bluffing, 5 to 11 October 2026

This is the week after the launch thread, which went live on 4 October: https://x.com/whos_bluffing/status/2106923319601643667.
It has twenty-one posts, three a day, plus seven poll reveals, a spare post, ten reply drafts, five named dares and a
checklist. The register is the same as the thread's: complete sentences, no slang, no hashtags, no emoji and no dashes.

## How to use

- Post at 09:00, 13:00 and 19:00 New York time. New York is on EDT this week, so that is 13:00, 17:00 and 23:00 UTC.
- Paste only the text inside the fences. Counts, poll options, notes and sources are for you.
- Every day opens with a poll at 09:00. Set its duration to 1 day. Polls carry no link; the reveal does.
- **The reveal goes out 24 hours after the poll**, at 09:00 the next day, as a reply to the poll. It is extra to that
  day's three posts. Sunday's reveal goes out on Monday 12 October.
- `{sure_wrong}` in a reveal is the percentage on the wrong answer's "sure" option, read off the closed poll.
- Counts are X's: a link or a bare domain counts 23, letters such as é and ² count 1, and no post uses emoji. Templates
  are counted with the sample fill named under them; the composer has the last word.
- Checked against `web/functions/_rounds.json` on 4 October: no post or reveal gives away a fact asked in that day's or
  the next day's ranked round or daily question. Bluff receipts quote yesterday's round only, after it has closed.
- Every fact has a Source line. If someone disputes an answer, reply with the link; if they are right, say so.

Spare post, for a receipt slot when the home page panel still shows its grey "Example" receipts:

```text
A wrong answer at 100% sure costs 300 points in our game. A right one pays 100, and 50% scores nothing either way.

So every question has two parts: which answer, and how sure you really are.

whosbluffing.com
```
Count: 216
Source: scoring in `web/public/index.html` (FAQ, "How are points worked out?").

---

## Monday 5 October

### 09:00 · Poll · Japan or Germany

```text
Which country is bigger by area, Japan or Germany?

Vote for an answer and for how sure you are. Choose "sure" only if you would stake 300 points on it.

The answer and its source follow tomorrow at 9:00 New York time.
```
Count: 218
Poll options (1 day): `Japan, sure` · `Japan, not sure` · `Germany, not sure` · `Germany, sure`

Reveal, Tuesday 6 October at 09:00, as a reply to this poll:

```text
Japan is bigger: 377,972 km² against 357,588 km² for Germany (Wikidata).

{sure_wrong}% of you picked Germany and said you were sure.

Our game is ten questions like this, with a stake on each, and a sure miss costs 300 points. whosbluffing.com
```
Count: 242 with {sure_wrong} = 100
Source: Japan https://www.wikidata.org/wiki/Q17#P2046 (`items/pool.json` w0005, fact-checked) · Germany
https://www.wikidata.org/wiki/Q183#P2046 (w0007, referenced).

### 13:00 · Dare · the brutal AI round

```text
A dare for anyone who follows AI closely: ten brutal questions about deals, chips, parameter counts and lawsuits, with a stake on each.

Above 500 means you read the papers. Below 0 means you read the headlines. Saying 50% on all ten scores exactly 0.

https://whosbluffing.com/?pack=ai&difficulty=brutal
```
Count: 276
Source: scoring in `web/public/index.html` FAQ: each answer scores 100 − 400 × (confidence − outcome)², so 50% scores 0
either way and a perfect round is 1,000. Brutal AI rounds draw tiers 2 and 3 (deals, money, lawsuits, technical numbers):
`web/public/packs.js`, `items/ai_curated.json`. The thresholds are labels, not statistics.

### 19:00 · Lab rivalry · March 2023

```text
March 2023, in order:

The 9th: xAI is founded.
The 14th: OpenAI announces GPT-4, and Anthropic introduces Claude the same day.
The 21st: Google opens early access to Bard.

Twelve days, four labs, one crowded calendar. How sure are you of the rest?

https://whosbluffing.com/?pack=ai
```
Count: 274
Source (all in `items/ai_curated.json`): xAI founded 9 March 2023, https://en.wikipedia.org/wiki/SpaceXAI · GPT-4
14 March 2023, https://en.wikipedia.org/wiki/GPT-4 · Claude 14 March 2023, https://www.anthropic.com/news/introducing-claude ·
Bard early access 21 March 2023, https://en.wikipedia.org/wiki/Google_Gemini#Launch.

---

## Tuesday 6 October

Also at 09:00: the reveal of Monday's poll, as a reply to it (text under Monday 09:00).

### 09:00 · Poll · H100 or M1 Ultra

```text
Which chip has more transistors, Nvidia's H100 or Apple's M1 Ultra?

Vote for an answer and for how sure you are. Choose "sure" only if you would stake 300 points on it.

The answer and its source follow tomorrow at 9:00 New York time.
```
Count: 235
Poll options (1 day): `H100, sure` · `H100, not sure` · `M1 Ultra, not sure` · `M1 Ultra, sure`

Reveal, Wednesday 7 October at 09:00, as a reply to this poll:

```text
Apple's M1 Ultra has more: 114 billion transistors, against 80 billion in Nvidia's H100 (Wikipedia).

{sure_wrong}% of you picked the H100 and said you were sure.

Brutal AI rounds are full of numbers like these: https://whosbluffing.com/?pack=ai&difficulty=brutal
```
Count: 227 with {sure_wrong} = 100
Source: M1 Ultra https://en.wikipedia.org/wiki/Apple_M1#:~:text=114%20billion · H100
https://en.wikipedia.org/wiki/Hopper_(microarchitecture)#:~:text=80%20billion%20transistors (both `items/ai_curated.json`, ai_tech).

### 13:00 · Bluff receipt (template)

```text
A bluff receipt from yesterday's ranked round:

{question}
One player said {wrong_pick}, 100% sure. It was {right_answer}. That cost 300 points.

{players} people played it, and {sure_share}% of their answers were at 100%.

whosbluffing.com
```
Count: 271 with the sample fill (47-character question, the Danube, the Mississippi, 10,000 players, 100%); the question and both names together may use up to 81 characters
Fill from Monday's ranked round (checklist items 4 to 6). Pick a receipt stamped 100 (−300); if the only ones are
stamped 90, write "90% sure" and "224 points".
Source: the "Biggest bluffs today" panel on the home page and `/api/round/stats?date=2026-10-05`.

### 19:00 · Lab rivalry · the Bard demo

```text
In February 2023, a demo of Google's Bard got a fact about the James Webb Space Telescope wrong. Alphabet's shares fell 8%, about $100 billion in market value.

A confident wrong answer is expensive. In our game it costs only 300 points.

whosbluffing.com
```
Count: 262
Source: `items/ai_curated.json` (ai_drama and ai_money, 8 February 2023):
https://en.wikipedia.org/wiki/Google_Gemini#:~:text=%24100%20billion%20loss%20in%20market%20value

---

## Wednesday 7 October

Also at 09:00: the reveal of Tuesday's poll, as a reply to it.

### 09:00 · Poll · Pluto or the Moon

```text
Which has the larger diameter, Pluto or the Moon?

Vote for an answer and for how sure you are. Choose "sure" only if you would stake 300 points on it.

The answer and its source follow tomorrow at 9:00 New York time.
```
Count: 217
Poll options (1 day): `Pluto, sure` · `Pluto, not sure` · `Moon, not sure` · `Moon, sure`

Reveal, Thursday 8 October at 09:00, as a reply to this poll:

```text
The Moon is bigger: 3,476 km across, against 2,376 km for Pluto (Wikidata).

{sure_wrong}% of you picked Pluto and said you were sure.

Ten questions like this take about a minute, and being sure only pays when you are right: whosbluffing.com
```
Count: 240 with {sure_wrong} = 100
Source: the Moon https://www.wikidata.org/wiki/Q405#P2386 (`items/pool.json` w1202) · Pluto
https://www.wikidata.org/wiki/Q339#P2386 (w1209); both referenced.

### 13:00 · Dare · the easy AI round

```text
The easy AI round: ten questions about famous names and years.

Get nine right at 100% and give an honest 50% on the tenth, and you score 900. Miss that tenth at 100% instead, and you score 600.

Can you get through ten without a bluff?

https://whosbluffing.com/?pack=ai&difficulty=easy
```
Count: 261
Source: scoring in `web/public/index.html` FAQ (100% right +100, 100% wrong −300, 50% scores 0). Easy AI rounds draw
tier 1, famous names and years: `web/public/packs.js`.

### 19:00 · Lab rivalry · Google and OpenAI

```text
Google is 17 years older than OpenAI. Its parent company is not: Alphabet was created in 2015, the same year OpenAI was founded.

Dates like these look easy until you have to say how sure you are.

https://whosbluffing.com/?pack=ai
```
Count: 221
Source: Google 1998, https://www.wikidata.org/wiki/Q95#P571 (`items/pool.json` w2603) · Alphabet 2015,
https://www.wikidata.org/wiki/Q20800404#P571 (w2676, fact-checked) · OpenAI December 2015,
https://en.wikipedia.org/wiki/OpenAI (`items/ai_curated.json`).

---

## Thursday 8 October

Also at 09:00: the reveal of Wednesday's poll, as a reply to it.

### 09:00 · Poll · OpenAI or Anthropic

```text
OpenAI raised money in April 2026, and Anthropic in May 2026. Which of the two was valued higher in its round?

Vote for an answer and for how sure you are. Choose "sure" only if you would stake 300 points on it.

The answer and its source follow tomorrow at 9:00 New York time.
```
Count: 278
Poll options (1 day): `OpenAI, sure` · `OpenAI, not sure` · `Anthropic, not sure` · `Anthropic, sure`

Reveal, Friday 9 October at 09:00, as a reply to this poll:

```text
Anthropic was valued higher: $965 billion in May 2026, against $852 billion for OpenAI in April (Wikipedia).

{sure_wrong}% of you picked OpenAI and said you were sure.

Anthropic was founded in 2021 by seven former OpenAI employees. The AI pack has more: https://whosbluffing.com/?pack=ai
```
Count: 270 with {sure_wrong} = 100
Source (`items/ai_curated.json`, ai_money and ai_company_founded): Anthropic $965 billion, May 2026,
https://en.wikipedia.org/wiki/Anthropic#:~:text=US%24965%20billion · OpenAI $852 billion, April 2026,
https://en.wikipedia.org/wiki/OpenAI#:~:text=post%2Dmoney%20valuation%20of%20%24852%20billion · seven former OpenAI
employees, https://en.wikipedia.org/wiki/Anthropic.

### 13:00 · Lab rivalry · version numbers

```text
OpenAI went from o1 to o3, skipping o2 because of a trademark clash with the O2 mobile network. Later, GPT-4.1 came out about seven weeks after GPT-4.5.

Version numbers are not dates. Which came out earlier, GPT-4o or o1?

https://whosbluffing.com/?pack=ai
```
Count: 247
Answer, for the replies: GPT-4o, May 2024. The o1 preview came out on 12 September 2024.
Source: o2, https://en.wikipedia.org/wiki/OpenAI_o3 · GPT-4.5 (27 February 2025) and GPT-4.1 (14 April 2025),
https://en.wikipedia.org/wiki/GPT-4.5 and https://en.wikipedia.org/wiki/GPT-4.1 (`posts/ai-humor.md`, facts 4 and 9) ·
GPT-4o https://en.wikipedia.org/wiki/GPT-4o · o1 https://en.wikipedia.org/wiki/OpenAI_o1#History (`items/ai_curated.json`).

### 19:00 · Bluff receipt (template)

```text
Yesterday's bluff receipt:

{question}
Someone went with {wrong_pick} at 100% sure. It was {right_answer}.

{players} people played, and {sure_share}% of their answers were at 100%. Being sure only pays when you are right.

whosbluffing.com
```
Count: 271 with the sample fill (47-character question, the Danube, the Mississippi, 10,000 players, 100%); the question and both names together may use up to 81 characters
Fill from Wednesday's ranked round (checklist items 4 to 6).
Source: the home page panel and `/api/round/stats?date=2026-10-07`.

---

## Friday 9 October

Also at 09:00: the reveal of Thursday's poll, as a reply to it.

### 09:00 · Poll · Punjabi or French

```text
Which language has more native speakers, Punjabi or French?

Vote for an answer and for how sure you are. Choose "sure" only if you would stake 300 points on it.

The answer and its source follow tomorrow at 9:00 New York time.
```
Count: 227
Poll options (1 day): `Punjabi, sure` · `Punjabi, not sure` · `French, not sure` · `French, sure`

Reveal, Saturday 10 October at 09:00, as a reply to this poll:

```text
Punjabi has more: about 125 million native speakers, against about 77 million for French (Wikidata). The question was about native speakers only.

{sure_wrong}% of you picked French and said you were sure.

Ten questions like this take about a minute: whosbluffing.com
```
Count: 266 with {sure_wrong} = 100
Source: Punjabi 125,000,000, https://www.wikidata.org/wiki/Q58635#P1098 (`items/pool.json` w2884) · French 77,200,000,
https://www.wikidata.org/wiki/Q150#P1098 (w2849);
both referenced, native speakers (Wikidata P1098).

### 13:00 · Dare · the normal AI round

```text
A Friday dare: ten AI questions at normal difficulty, from founding dates to funding rounds, with a stake on each answer.

Finish above 700 and you can explain AI at dinner. Finish below 0 and you would have scored more by saying 50% every time.

https://whosbluffing.com/?pack=ai&difficulty=normal
```
Count: 270
Source: scoring in `web/public/index.html` FAQ (50% on every answer scores exactly 0; a perfect round is 1,000). Normal AI
rounds draw tiers 1 and 2: `web/public/packs.js`.

### 19:00 · Lab rivalry · Amazon backs both

```text
Amazon had put $8 billion into Anthropic by November 2024. In February 2026, it led OpenAI's round with $50 billion.

If you cannot decide which lab is right, you can back both. Our game does not allow that: you pick A or B, then say how sure you are.

whosbluffing.com
```
Count: 276
Source (`items/ai_curated.json`, ai_money): https://en.wikipedia.org/wiki/Anthropic#:~:text=doubling%20its%20total%20investment ·
https://en.wikipedia.org/wiki/OpenAI#:~:text=led%20by%20Amazon%20%28%2450%20billion%29

---

## Saturday 10 October

Also at 09:00: the reveal of Friday's poll, as a reply to it.

### 09:00 · Poll · Grok-1 or GPT-3

```text
Which model has more parameters, xAI's Grok-1 or OpenAI's GPT-3?

Vote for an answer and for how sure you are. Choose "sure" only if you would stake 300 points on it.

The answer and its source follow tomorrow at 9:00 New York time.
```
Count: 232
Poll options (1 day): `Grok-1, sure` · `Grok-1, not sure` · `GPT-3, not sure` · `GPT-3, sure`

Reveal, Sunday 11 October at 09:00, as a reply to this poll:

```text
Grok-1 has more: 314 billion parameters, against 175 billion for GPT-3. Grok-1 is a mixture-of-experts model (xAI; Wikipedia).

{sure_wrong}% of you picked GPT-3 and said you were sure.

Brutal AI rounds have more numbers like these: https://whosbluffing.com/?pack=ai&difficulty=brutal
```
Count: 248 with {sure_wrong} = 100
Source (`items/ai_curated.json`, ai_params): Grok-1 https://x.ai/news/grok-os · GPT-3
https://en.wikipedia.org/wiki/GPT-3#GPT-3_models

### 13:00 · Dare · your Discord server

```text
A weekend dare for your Discord server: one question a day, a stake on every answer, and a reveal with the top 5 and the bluff of the day.

Roast mode is off by default. If your friends can take it, turn it on and the reveal names the biggest bluffer.

whosbluffing.com/discord
```
Count: 276
Source: `web/public/discord.html` (hero line; FAQ "What is roast mode?").

### 19:00 · Bluff receipt (template)

```text
Yesterday's receipts are in.

{question}
Someone picked {wrong_pick} at 100% sure. It was {right_answer}.

{players} people played, and {sure_share}% of their answers were at 100%. Those answers were right {right_at_100}% of the time.

whosbluffing.com
```
Count: 272 with the sample fill (47-character question, the Danube, the Mississippi, 10,000 players, 100%); the question and both names together may use up to 80 characters
Fill from Friday's ranked round (checklist items 4 to 6).
Source: the home page panel and `/api/round/stats?date=2026-10-09`.

---

## Sunday 11 October

Also at 09:00: the reveal of Saturday's poll, as a reply to it.

### 09:00 · Poll · Mont Blanc or the Matterhorn

```text
Which mountain is higher, Mont Blanc or the Matterhorn?

Vote for an answer and for how sure you are. Choose "sure" only if you would stake 300 points on it.

The answer and its source follow tomorrow at 9:00 New York time.
```
Count: 223
Poll options (1 day): `Mont Blanc, sure` · `Mont Blanc, not sure` · `Matterhorn, not sure` · `Matterhorn, sure`

Reveal, Monday 12 October at 09:00, as a reply to this poll:

```text
Mont Blanc is higher: 4,806 m against 4,478 m for the Matterhorn (Wikidata).

{sure_wrong}% of you picked the Matterhorn and said you were sure.

There is a new ranked round every day, the same ten questions for everyone: whosbluffing.com
```
Count: 236 with {sure_wrong} = 100
Source: Mont Blanc https://www.wikidata.org/wiki/Q583#P2044 (`items/pool.json` w0234) · Matterhorn
https://www.wikidata.org/wiki/Q1374#P2044 (w0244); both fact-checked.

### 13:00 · Lab rivalry · too agreeable

```text
In April 2025, OpenAI rolled back a GPT-4o update that the coverage called "sycophantic": it had made ChatGPT too agreeable.

Our game has the opposite problem. It tells you exactly what your confidence cost.

whosbluffing.com
```
Count: 233
Source: `items/ai_curated.json` (ai_drama, 29 April 2025):
https://en.wikipedia.org/wiki/GPT-4o#:~:text=rolled%20back%20an%20update%20of%20GPT%2D4o

### 19:00 · Dare · your type

```text
A Sunday dare: play one round, then reply with your type. It will be Bluffer, Too sure, Spot on, Too modest or Playing it safe.

Spot on means your confidence matched how often you were right, within 5 points. It is harder than it sounds.

whosbluffing.com
```
Count: 263
Source: the type definitions in `web/public/index.html` (type tiles and FAQ).

---

## Replies under big AI accounts

Ten link-free drafts, one sourced question each, keyed to the topics big accounts post about. The rules are those of
`posts/reply-templates.md`, "When to use": reply within 10 minutes of their post or skip it; one reply per post, never
two in a thread; stop a draft after 3 uses; speak to the thread ("anyone reading", "the replies"), never to the account
holder; never say or imply the account holder is wrong; skip posts about accidents, layoffs, harm or anything somber;
post by hand. No link, as in `x/src/replies.js`: the profile carries it.

### 1 · Model launches

```text
Here is a question for anyone reading this thread. Which came out earlier, Midjourney's open beta or Stable Diffusion's public release? Pick one, then decide how sure you are.
```
Count: 175
Answer: Midjourney's open beta, 12 July 2022. Stable Diffusion's public release was on 22 August 2022.
Sources: https://en.wikipedia.org/wiki/Midjourney#History · https://stability.ai/news-updates/stable-diffusion-public-release
Uses: [ ] [ ] [ ]

### 2 · Model launches

```text
A question for the replies. Which was released earlier, Meta's Llama 3 or OpenAI's GPT-4o? Most people will answer quickly. Fewer would stake 100% on their answer.
```
Count: 163
Answer: Llama 3, 18 April 2024. GPT-4o came out in May 2024.
Sources: https://en.wikipedia.org/wiki/Llama_(language_model)#Llama_3 · https://en.wikipedia.org/wiki/GPT-4o
Uses: [ ] [ ] [ ]

### 3 · Compute

```text
For anyone following the compute debate: which took more compute to train, GPT-3 or DeepMind's smaller Chinchilla? Decide how sure you are before you look it up.
```
Count: 161
Answer: Chinchilla, 6,805 petaFLOP-days against 3,640 for GPT-3. Chinchilla has 70 billion parameters, GPT-3 175 billion.
Sources: https://en.wikipedia.org/wiki/List_of_large_language_models · https://en.wikipedia.org/wiki/Chinchilla_(language_model)
Uses: [ ] [ ] [ ]

### 4 · Compute

```text
Here is one for everyone in this thread. Which has more memory, Nvidia's H100 or AMD's MI300X? It is easy to answer and harder to be sure about.
```
Count: 144
Answer: the MI300X, with 192 GB of HBM3. The H100 has up to 80 GB.
Sources: https://en.wikipedia.org/wiki/AMD_Instinct · https://en.wikipedia.org/wiki/Hopper_(microarchitecture)
Never under a post by anyone from Nvidia or AMD.
Uses: [ ] [ ] [ ]

### 5 · Safety

```text
For anyone reading about AI rules: which happened earlier, the EU AI Act entering into force or California's governor vetoing SB 1047? Pick one, then decide how sure you are.
```
Count: 174
Answer: the EU AI Act, in force from 1 August 2024. SB 1047 was vetoed on 29 September 2024.
Sources: https://en.wikipedia.org/wiki/Artificial_Intelligence_Act ·
https://en.wikipedia.org/wiki/Safe_and_Secure_Innovation_for_Frontier_Artificial_Intelligence_Models_Act
Uses: [ ] [ ] [ ]

### 6 · Funding

```text
A question for anyone tracking AI deals. Which was bigger, Microsoft's investment in Mistral AI in February 2024 or its payment to Inflection in March 2024? Try it without searching.
```
Count: 182
Answer: the Inflection payment, $650 million to license its technology. The Mistral investment was $16 million.
Sources: https://en.wikipedia.org/wiki/Inflection_AI · https://en.wikipedia.org/wiki/Mistral_AI
Never under a post by anyone from Microsoft, Mistral AI or Inflection.
Uses: [ ] [ ] [ ]

### 7 · Funding

```text
Here is one for the replies. Which was larger, Nvidia's one-day fall in market value in January 2025 or OpenAI's valuation in its April 2025 round? Notice how sure you feel before you check.
```
Count: 190
Answer: Nvidia's fall, about $600 billion in one day. OpenAI's April 2025 round valued it at $300 billion.
Sources: https://en.wikipedia.org/wiki/Nvidia · https://en.wikipedia.org/wiki/OpenAI
Never under a post by anyone from Nvidia.
Uses: [ ] [ ] [ ]

### 8 · Lawsuits

```text
For anyone following the copyright cases: which was filed earlier, the Authors Guild's lawsuit against OpenAI or the one brought by The New York Times? Decide how sure you are, then check.
```
Count: 188
Answer: the Authors Guild's, filed on 19 September 2023 with 17 authors. The Times sued OpenAI and Microsoft on
27 December 2023.
Source: https://en.wikipedia.org/wiki/OpenAI (both suits; `items/ai_curated.json`, ai_drama)
Never under a post by anyone from OpenAI, Microsoft, The New York Times or the Authors Guild.
Uses: [ ] [ ] [ ]

### 9 · Lawsuits

```text
Here is a question for anyone reading. Which was larger, Anthropic's settlement with book authors or Microsoft's initial investment in OpenAI? It sounds easy until you have to say how sure you are.
```
Count: 197
Answer: the settlement, $1.5 billion (September 2025). Microsoft's initial investment in OpenAI was $1 billion (July 2019).
Sources: https://en.wikipedia.org/wiki/Anthropic ·
https://news.microsoft.com/source/2019/07/22/openai-forms-exclusive-computing-partnership-with-microsoft-to-build-new-azure-ai-supercomputing-technologies/
Never under a post by anyone from Anthropic, Microsoft or OpenAI. Not on 7 or 8 October: the ranked round of 8 October
asks when Microsoft's $1 billion went in.
Uses: [ ] [ ] [ ]

### 10 · Benchmarks

```text
For anyone reading the benchmark charts: which classic dataset has more images, MNIST or CIFAR-10? Pick one, then decide honestly how sure you are.
```
Count: 147
Answer: MNIST, 70,000 images (60,000 for training and 10,000 for testing). CIFAR-10 has 60,000.
Sources: https://en.wikipedia.org/wiki/MNIST_database · https://en.wikipedia.org/wiki/CIFAR-10
Uses: [ ] [ ] [ ]

### Named dares (the owner's request)

Five polite dares addressed to the account holder, in the owner's shape. They are the one exception to "speak to the
thread", and they carry the link. Post one only as a reply under that person's own post about AI or their company, never
under a somber post; once per person, ever; at most one named dare a day; by hand. A brutal round draws from ai_drama,
which includes Musk v. Altman, Altman's removal by the OpenAI board and Grok's July 2025 posts, so the round may show a
question about the person's own company. Decide with that in view.

```text
Mr. Altman, I would bet you can't get all ten of these right: https://whosbluffing.com/?pack=ai&difficulty=brutal
```
Count: 85
Uses: [ ]

```text
Mr. Musk, with respect, I would bet you can't get all ten of these right. They are hard, and every answer has a source: https://whosbluffing.com/?pack=ai&difficulty=brutal
```
Count: 143
Uses: [ ]

```text
Mr. Amodei, a polite challenge: ten hard questions about the AI industry, each with a source. I would bet you can't get all ten right: https://whosbluffing.com/?pack=ai&difficulty=brutal
```
Count: 158
Uses: [ ]

```text
Mr. Pichai, I would bet you can't get all ten of these right, though I suspect you know more of them than most: https://whosbluffing.com/?pack=ai&difficulty=brutal
```
Count: 135
Uses: [ ]

```text
Mr. Nadella, here are ten hard questions about AI. I would bet you can't get all ten right, and I would be glad to lose that bet: https://whosbluffing.com/?pack=ai&difficulty=brutal
```
Count: 153
Uses: [ ]

---

## Checklist for the owner

1. Pin the launch thread now and keep it pinned through Sunday; on Monday 12 October, pin whichever post of the week drew the most replies.
2. Set every poll to 1 day and post it at 09:00; post its reveal as a reply to it 24 hours later, once X shows the final results (a minute or two after 09:00); Sunday's reveal is Monday 12 October.
3. When a poll closes, screenshot the final result and keep it; `{sure_wrong}` is the percentage on the wrong answer's "sure" option (for Monday, "Germany, sure").
4. Every evening at about 19:30 New York, before the ranked round closes at 20:00 (00:00 UTC), screenshot the home page panel "Biggest bluffs today" and play that day's round, so you know both options of each receipt.
5. Post a receipt only the next day and only from a real panel: if its caption still says "Example" (fewer than 5 players finished), post the spare from the header instead.
6. `{players}`, `{sure_share}` and `{right_at_100}`: open `whosbluffing.com/api/round/stats?date=YYYY-MM-DD` with the round's UTC date; `players` is the count; in the list of `{conf, n, right}` entries, `{sure_share}` = n at conf 100 ÷ the sum of all n, and `{right_at_100}` = right ÷ n at conf 100, both as whole percents.
7. Click the easy and normal AI links once before posting those dares (only `?pack=ai` and the brutal link were verified on 4 October), then play the linked round yourself and reply under the dare with your real result line.
8. In the hour after each post, answer every reply (in X's published ranking weights, a reply the author engages with counts 75 against 0.5 for a like); mute bad-faith replies instead of arguing.
9. Replies and named dares: by hand, within 10 minutes of the big account's post, one per thread; tick the boxes, stop each draft at 3 uses and each named dare at 1.
10. Before pasting, let the composer confirm each count (links count 23); if anything runs long, cut words, never facts or sources; if an answer is disputed, reply with its Source link, and if the critic is right, say so and flag the question in the game.
