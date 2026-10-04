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
