# HowSure — Pre-registration (v0 DRAFT, 2026-10-03)

Status: draft. The final version is committed **before** the public launch of the web test and **before** the Anki add-on's data-sharing switch is enabled. Any deviation after that is logged in `CHANGELOG.md` with date and reason. Independent, unaffiliated project; anonymous opt-in data; no IRB review.

## Study A — Web game (cross-sectional and within-person)

**Design (revised 2026-10-03, before launch; see CHANGELOG).** The viral game is a round of 10 two-alternative comparison questions ("Which is longer: the Nile or the Danube?"). For each, the player picks an option and states a confidence of 50, 60, 70, 80, 90 or 100%, then sees the truth and both sources. Points follow the quadratic proper scoring rule 100 − 400(c − y)² (50% scores 0; 100% right +100; 100% wrong −300), so honest confidence maximizes expected points. One **ranked round** per UTC day (same 10 items for everyone, drawn only from items with a Wikidata reference or an independent fact-check) plus unlimited **quick rounds**. Challenge links let a second player take the same round. In Slack and Discord, one comparison question is posted per day in a channel; members answer with a confidence and the result is revealed at the community's hour; members can also play full rounds inside the chat app. The 5-minute **full assessment** at `/test` keeps the earlier design (12 two-alternative items + 6 interval items + 2 attention checks).

**Items.** Comparison pairs are generated from numeric facts of the same category and measurement definition with a ratio ≥ 1.3 (year categories: "Which came first?" with a gap ≥ 10 years); city populations are excluded. Every underlying value carries a source link; a flagged pair retires, and so does any pair sharing a retired value. Pair difficulty is first estimated from the ratio and later from play data.

**Measures.** Overconfidence = mean confidence − accuracy. Brier score. Quadratic points. Calibration bins per confidence level. AUROC (exploratory). Interval hit rate only for the full assessment. Definitions and vectors: `analysis/test_vectors.json`.

**Hypotheses.**
- H1 (replication). Overconfidence > 0 across players (one-sided), and the hard–easy effect: overconfidence rises as pair accuracy falls (item-level, Spearman, one-sided).
- H2 (format and difficulty). In the full assessment, overconfidence is larger for interval items than for two-alternative items (two-sided); in rounds, overconfidence by difficulty bin.
- H3 (practice effect, within-person). Among players with ≥ 10 completed rounds, overconfidence falls and quadratic points rise across rounds 1–20. Mixed-effects models with player random intercepts and slopes, items crossed. Survivorship check (pre-specified): round-1 overconfidence of players who later reach ≥ 10 rounds versus those who stop before 3; if they differ, the effect is reported conditional on persistence and labelled as such. A null is reported as a null.
- Exploratory (labelled): challenge-link pairs (does playing against a named challenger change confidence?); Slack roast mode on vs off; age/education/region from the optional full-assessment demographics.

**Engagement numbers (reported, not hypotheses).** Rounds per player per day; day-1 and day-7 return rates by first-play cohort; challenge conversion (completed rounds per challenge view); share rate (share events per completed round).

**Timing and sample size.** First confirmatory analysis when completed rounds ≥ 20,000 from ≥ 5,000 players; H3 when ≥ 1,000 players have ≥ 10 rounds; full-assessment hypotheses when passed sessions ≥ 5,000.

**Exclusions (pre-specified).** Rounds with any answer under 700 ms on the web; incomplete rounds; honeypot; duplicate rounds from the same anonymous id beyond the first for the same ranked day; items retired after flags (exclusion flags kept in the data, not deleted).

**Inference.** Bootstrap 95% CIs resampling players; α = 0.05.

## Study B — Anki add-on (longitudinal; data sharing is opt-in and starts in v0.2)

**Design.** Before each flashcard answer the learner presses 1–5 ("how sure are you?"); the add-on records the rating, the subsequent grade (Again/Hard/Good/Easy), response times, the scheduled interval, days since last review, and FSRS memory state when available. Card content is never recorded.

**Hypotheses.**
- H1. Calibration and hard–easy effect in daily study: recall rate rises with rating; overconfidence (mapped rating − recall rate) is largest on the lowest-recall decks/items.
- H2. Ratings are less sensitive to the scheduled interval than recall is: the correlation of rating with FSRS retrievability is weaker than the correlation of recall with retrievability.
- H3. Ratings add predictive information beyond FSRS retrievability R: per user, time-ordered split; compare log-loss of logit(p) = logit(R) + β·(rating − mean) with logit(p) = logit(R). Adopt if relative log-loss improvement ≥ 1% with bootstrap 95% CI across users excluding 0. A null is reported as a null.

**Exclusions.** Users with < 200 rated reviews; ratings with question-side response time < 300 ms; decks with < 30 reviews for per-deck statistics.

**Models.** Mixed-effects logistic regression: recall ~ rating + log(days since last review) + (1 + rating | user).

## Metric definitions (for any public number)
- **MAU**: anonymous ids with ≥ 1 play — a completed round of 10 (ranked or quick), a completed full assessment, or an in-channel Slack or Discord answer to the daily question — in the trailing 30 days, summed across web and Slack without cross-surface deduplication (a person who plays on both counts twice; stated wherever MAU is reported). **DAU** likewise for one UTC day.
- **Communities**: Slack workspaces, Discord servers and rooms with ≥ 1 play in the trailing 30 days, plus classrooms with ≥ 5 finished assessments; reported per platform and summed.
- Computed once a day by a scheduled job into a `kpi` table; the public stats page and any application text use only that table.

## Data release

Anonymous row-level data for both studies (with exclusion flags) released on OSF, Hugging Face and Kaggle with a data card describing collection, sample bias and intended use. Classroom sessions are pooled without class codes. Code for every analysis is in `analysis/`.
