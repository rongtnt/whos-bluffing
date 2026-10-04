# Changelog

Deviations from `prereg/PREREG.md` after it is finalized are logged here with a date and a reason.

## 2026-10-03
- Repo created. Design docs, pre-registration draft v0, privacy policy, item schema, shared metric test vectors.

## 2026-10-03 (later)
- Scope change before launch: English only (Chinese UI, items and channels removed); the bilingual foreign-language hypothesis is replaced by a within-person practice-effect hypothesis (H3). Daily game and Slack app added as the primary surfaces; MAU and community definitions added to PREREG. Reason: distribution redesign for scale (docs/design-v4-scale.md).

## 2026-10-03 (evening)
- Game loop redesigned before launch: the viral game becomes 10-question comparison rounds with staked confidence (quadratic scoring), ranked daily round + unlimited quick rounds, challenge links, and a one-question-a-day Slack post with an anonymous reveal (optional roast mode). Intervals stay in the full assessment only. PREREG Study A rewritten accordingly; play and MAU definitions updated; engagement metrics added. Reason: the interval-typing loop had no social or repeat-play hook (docs/api-rounds.md, briefs/BRIEF_rounds.md).
- Discord added as a surface (user lifted the earlier restriction); communities now counted per platform.

## 2026-10-04
- Renamed from HowSure to Who's Bluffing? (howsure.me belongs to an unrelated product)

## 2026-10-04
- Pre-registration frozen as v1 (tag `prereg-v1`) ahead of the 2026-10-05 public launch; the MAU definition now names Discord alongside web and Slack. Plays before the freeze are test plays and are excluded.
- New brand mark: two fanned cards with a square turned 45° cut out of the front card as the diamond pip (`brand/`). The five-squares-in-a-row mark and an interim question-mark mark are retired.
- Slack and Discord Workers provisioned on Cloudflare (D1 databases, BOT_KEY and SALT secrets); the Slack manifest carries the real Worker host.

## 2026-10-04 (night)
- AI pack added (`items/ai_curated.json`, 118 hand-curated items): `ai_timeline` (44 events at month precision, "Which came first?"), `ai_released` (33), `ai_company_founded` (22) and `ai_params` (19, published parameter counts only, "Which model has more parameters?"). Each value was checked against Wikipedia or the company's own announcement page. The items are fact-checked and count as famous in quick rounds whatever their pageviews; the AI pack is second in the pack list.
- Deviation: PREREG requires at least 10 years between the two items of a year pair. The AI year categories use at least 2 years and `ai_timeline` at least 3 months, because the field is young (`min_gap` in each template of `items/pairs.json`). Difficulty scales with the minimum gap (easy at 5 times it, medium at 2 times: 10 and 4 years, 15 and 6 months); `ai_params` keeps the 1.3 ratio.
- Deviation: from 2026-10-05, slot 1 of every ranked round is one `ai_timeline` pair (owner request: AI questions first in the game). It counts toward the 3/4/3 mix (on the existing days it replaced a pair of the same difficulty), both of its items have at least 50,000 monthly views of their own, and it is the day's only AI pair. The other AI categories stay out of ranked rounds and the chat question. Days 2026-10-05 to 2027-02-01 were edited once for this (an exception to append-only); 2026-10-04 and earlier are unchanged.
