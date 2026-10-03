# HowSure — Pre-registration (v0 DRAFT, 2026-10-03)

Status: draft. The final version is committed **before** the public launch of the web test and **before** the Anki add-on's data-sharing switch is enabled. Any deviation after that is logged in `CHANGELOG.md` with date and reason. Independent, unaffiliated project; anonymous opt-in data; no IRB review.

## Study A — Web test (cross-sectional, with a within-subject bilingual arm)

**Design.** English-only (the Chinese arm was removed on 2026-10-03 before launch; see CHANGELOG). Two formats: the full 5-minute assessment, and a daily game of 5 interval items (same items for everyone each UTC day) with immediate feedback and a shareable result. Each session: 12 two-alternative general-knowledge items with a confidence rating (50/60/70/80/90/100%), 6 numeric items answered with a range the participant is 90% sure contains the truth, 2 attention-check items. Full-assessment items are drawn at random from the hand-checked bank (40 + 20 + 2). Daily items come from a generated pool (Wikidata and official sources; every item carries a source link and sanity bounds); the maintainer reviews the next day's five items before they air. Optional demographics (age band, education, native language, region). Country at ISO-country level from the request, never IP. Players are identified only by an anonymous local id (web) or a salted hash of workspace and member ids (Slack).

**Measures.** Overconfidence = mean confidence − accuracy. Brier score. Calibration bins per confidence level. Interval hit rate = share of ranges containing the truth (inclusive); interval overconfidence = 0.90 − hit rate. AUROC (exploratory). Definitions and test vectors: `analysis/test_vectors.json`.

**Hypotheses.**
- H1 (replication). (a) Overconfidence > 0 in both languages (one-sided). (b) Interval hit rate < 0.90 in both languages (one-sided). (c) Hard–easy effect: across items, item accuracy and item overconfidence are negatively correlated (Spearman, one-sided).
- H2 (format and difficulty). Overconfidence is larger for interval items than for two-alternative items (format effect; two-sided), and item-level overconfidence increases with item difficulty estimated by a 1-PL IRT model on the large daily-game samples.
- H3 (practice effect, within-person; daily game). Among players with ≥ 7 completed daily plays, the interval hit rate rises and interval width (log ratio of high/low) falls across plays 1–14. Analysis: mixed-effects regression of hit (logistic) and log-width (linear) on play index with player random intercepts and slopes; items as crossed random effects. Survivorship check (pre-specified): compare play-1 hit rate and width of players who later reach ≥ 7 plays with those who stop before 3; if they differ, the practice effect is reported conditional on persistence and labelled as such. A null is reported as a null.
- Exploratory (labelled as such in all reports): age band, education, region; relation between two-alternative and interval overconfidence (format effect); comparison with language models answering identical items.

**Item integrity.** Every item carries a source. Players can flag an item; three distinct flags retire it pending review, and the affected day's scores are recomputed without it. Retired items are listed in the report and excluded from H1–H3.

**Timing and sample size.** First confirmatory analysis when passed full-assessment sessions ≥ 5,000; H3 when ≥ 1,000 players have ≥ 7 completed daily plays. Interim looks are for data quality only; no result-dependent stopping.

**Exclusions (pre-specified).** Session fails either attention item; any item answered in < 1,500 ms; incomplete session; honeypot field filled; interval entries outside the item's sanity bounds (item-level exclusion); repeat sessions from the same browser identifier (keep the first). Exclusion flags are kept in the released data, not deleted.

**Inference.** Bootstrap 95% CIs resampling participants; α = 0.05.

## Study B — Anki add-on (longitudinal; data sharing is opt-in and starts in v0.2)

**Design.** Before each flashcard answer the learner presses 1–5 ("how sure are you?"); the add-on records the rating, the subsequent grade (Again/Hard/Good/Easy), response times, the scheduled interval, days since last review, and FSRS memory state when available. Card content is never recorded.

**Hypotheses.**
- H1. Calibration and hard–easy effect in daily study: recall rate rises with rating; overconfidence (mapped rating − recall rate) is largest on the lowest-recall decks/items.
- H2. Ratings are less sensitive to the scheduled interval than recall is: the correlation of rating with FSRS retrievability is weaker than the correlation of recall with retrievability.
- H3. Ratings add predictive information beyond FSRS retrievability R: per user, time-ordered split; compare log-loss of logit(p) = logit(R) + β·(rating − mean) with logit(p) = logit(R). Adopt if relative log-loss improvement ≥ 1% with bootstrap 95% CI across users excluding 0. A null is reported as a null.

**Exclusions.** Users with < 200 rated reviews; ratings with question-side response time < 300 ms; decks with < 30 reviews for per-deck statistics.

**Models.** Mixed-effects logistic regression: recall ~ rating + log(days since last review) + (1 + rating | user).

## Metric definitions (for any public number)
- **MAU**: anonymous ids with ≥ 1 completed play (full assessment or daily game) in the trailing 30 days, summed across web and Slack without cross-surface deduplication (a person who plays on both counts twice; stated wherever MAU is reported). **DAU** likewise for one UTC day.
- **Communities**: Slack workspaces with ≥ 1 completed play in the trailing 30 days plus classrooms with ≥ 5 finished assessments.
- Computed once a day by a scheduled job into a `kpi` table; the public stats page and any application text use only that table.

## Data release

Anonymous row-level data for both studies (with exclusion flags) released on OSF, Hugging Face and Kaggle with a data card describing collection, sample bias and intended use. Classroom sessions are pooled without class codes. Code for every analysis is in `analysis/`.
