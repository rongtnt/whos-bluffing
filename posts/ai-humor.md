# AI pack humor: reactions, reveal facts and X posts (draft, 2026-10-04)

For the AI pack, once it is live. The jokes are about how the labs behave as institutions (racing each other to ship,
long safety posts, model names that read like a password policy), never about any person's character or honesty. Every
factual hook below was checked against its linked source on 2026-10-04. Same register as the other posts: correct
grammar, casual, no slang, no exclamation marks; no "first" or "largest"; nothing says or implies that AI built the game.

## 1. In-game reactions (AI pack only)

Same format as `web/public/reactions.js`: one line after an answer, `{conf}` is the stake. Each is at most 80
characters. Lines marked (sure) assume a stake of 90% or more.

**Right (8)**

- Shipped before the competitor's blog post. Nice.
- Correct, and released without a waitlist.
- Right. No system card needed for that one.
- Correct at {conf}%. Better calibrated than most launch dates.
- Right, and nobody had to rename it afterwards.
- Right. In a lab, that answer would ship as v2-pro-max-preview.
- Correct, in less time than a model naming meeting.
- Right, and nobody had to announce it in a livestream.

**Wrong (8)**

- Confident, unverified, and already deprecated. (sure)
- Somewhere a lab is drafting a safety post about that answer.
- {conf}% sure and wrong. The labs call that a hallucination. (sure)
- Wrong, but announced with the confidence of a launch event. (sure)
- Not quite. A new version of that answer ships this afternoon.
- Wrong. It won't be mentioned in the release notes.
- That answer has been rolled back.
- Wrong at {conf}%. The benchmark looked so promising.

## 2. Reveal facts

One line under the answer, each at most 140 characters, shown with the item or pair named.

| # | Show with | Fact | Source |
|---|---|---|---|
| 1 | Claude or GPT-4 (release year) | Anthropic introduced Claude on 14 March 2023, the same day OpenAI announced GPT-4. | https://www.anthropic.com/news/introducing-claude · https://en.wikipedia.org/wiki/GPT-4 |
| 2 | OpenAI (founding year) | OpenAI was founded as a non-profit in December 2015 and created a capped-profit company in 2019. | https://en.wikipedia.org/wiki/OpenAI |
| 3 | Anthropic (founding year) | Anthropic was founded in January 2021 by seven former OpenAI employees. | https://en.wikipedia.org/wiki/Anthropic |
| 4 | o1 or o3 (release year) | OpenAI went from o1 to o3. It skipped o2 to avoid a trademark clash with the O2 mobile network. | https://en.wikipedia.org/wiki/OpenAI_o3 |
| 5 | Transformer paper (2017) | After the Transformer paper, each of its eight authors left Google to join other companies or start their own. | https://en.wikipedia.org/wiki/Attention_Is_All_You_Need |
| 6 | GPT-2 (release year or parameters) | OpenAI held back the full GPT-2 in February 2019 over misuse concerns, then released all of it in November 2019. | https://en.wikipedia.org/wiki/GPT-2 |
| 7 | Stable Diffusion vs ChatGPT | Stable Diffusion came out on 22 August 2022, about three months before ChatGPT. | https://en.wikipedia.org/wiki/Stable_Diffusion · https://en.wikipedia.org/wiki/ChatGPT |
| 8 | DeepMind vs OpenAI (founding year) | DeepMind was founded in November 2010, five years before OpenAI. | https://en.wikipedia.org/wiki/Google_DeepMind · https://en.wikipedia.org/wiki/OpenAI |
| 9 | GPT-4.1 or GPT-4.5 (release year) | GPT-4.1 came out on 14 April 2025, about seven weeks after GPT-4.5. Version numbers are more of a suggestion. | https://en.wikipedia.org/wiki/GPT-4.1 · https://en.wikipedia.org/wiki/GPT-4.5 |
| 10 | Bard or Gemini (release year) | Google's Bard opened in March 2023 and was renamed Gemini in February 2024, less than a year later. | https://en.wikipedia.org/wiki/Gemini_(chatbot) |

Fact 5 says "left", not "have all left": one author rejoined Google in 2024 and reportedly left again in 2026, so
claims about where they are now go stale.

## 3. X posts for @whos_bluffing

Post only once the AI pack is live. Each is at most 280 characters and ends with a question and the link; the answer
and its source are under each post for the replies.

### P1 · same-day launch

```text
Anthropic introduced Claude on 14 March 2023, and OpenAI announced GPT-4 the same day. If anyone asks which came out earlier, the honest answer is neither. Here is one with a real answer. Which came out earlier, GPT-4 or Stable Diffusion? whosbluffing.com
```

Answer: Stable Diffusion, 22 August 2022. GPT-4 was announced on 14 March 2023.
Sources: https://en.wikipedia.org/wiki/Stable_Diffusion · https://en.wikipedia.org/wiki/GPT-4

### P2 · the missing o2

```text
OpenAI went from o1 straight to o3 because O2 is a mobile network's trademark. Naming models may be the hardest problem in the field. Which came out earlier, GPT-4o or o1? whosbluffing.com
```

Answer: GPT-4o, 13 May 2024. o1 followed later in 2024 (a preview in September, the full model in December).
Sources: https://en.wikipedia.org/wiki/GPT-4o · https://en.wikipedia.org/wiki/OpenAI

### P3 · the Transformer authors

```text
After the Transformer paper, each of its eight authors left Google to join other companies or start their own. Google kept the paper. Which came out earlier, the Transformer paper or AlphaGo Zero? whosbluffing.com
```

Answer: the Transformer paper, June 2017. AlphaGo Zero was published in Nature on 19 October 2017.
Sources: https://arxiv.org/abs/1706.03762 · https://en.wikipedia.org/wiki/AlphaGo_Zero

### P4 · GPT-2, held back

```text
In February 2019, OpenAI held back the full GPT-2 over concerns about misuse. In November 2019, it released the whole thing. Which has more parameters, GPT-2 or BERT-Large? whosbluffing.com
```

Answer: GPT-2, 1.5 billion. BERT-Large has 340 million.
Sources: https://en.wikipedia.org/wiki/GPT-2 · https://en.wikipedia.org/wiki/BERT_(language_model)

### P5 · before ChatGPT

```text
Stable Diffusion came out about three months before ChatGPT, which is easy to forget now. Which came out earlier, Stable Diffusion or Bard? whosbluffing.com
```

Answer: Stable Diffusion, 22 August 2022. Bard opened on 21 March 2023.
Sources: https://en.wikipedia.org/wiki/Stable_Diffusion · https://en.wikipedia.org/wiki/Gemini_(chatbot)

### P6 · version numbers

```text
GPT-4.1 came out about seven weeks after GPT-4.5. Model version numbers follow rules of their own. Which came out earlier, GPT-4o or GPT-4.5? whosbluffing.com
```

Answer: GPT-4o, 13 May 2024. GPT-4.5 was released on 27 February 2025.
Sources: https://en.wikipedia.org/wiki/GPT-4o · https://en.wikipedia.org/wiki/GPT-4.5
