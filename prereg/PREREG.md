# HowSure — Pre-registration (v0 DRAFT, 2026-10-03)

Status: draft. The final version is committed **before** the public launch of the web test and **before** the Anki add-on's data-sharing switch is enabled. Any deviation after that is logged in `CHANGELOG.md` with date and reason. Independent, unaffiliated project; anonymous opt-in data; no IRB review.

## Study A — Web test (cross-sectional, with a within-subject bilingual arm)

**Design.** Free 5-minute web test in English (en) and Chinese (zh). Each session: 12 two-alternative general-knowledge items with a confidence rating (50/60/70/80/90/100%), 6 numeric items answered with a range the participant is 90% sure contains the truth, 2 attention-check items. Items are drawn at random from a bank of 40 + 20 + 2 per language; en and zh items ask the same facts. Optional demographics (age band, education, native language, region). Country at ISO-country level from the request, never IP. Participants who report being bilingual may take a second set in the other language; the second session is linked to the first.

**Measures.** Overconfidence = mean confidence − accuracy. Brier score. Calibration bins per confidence level. Interval hit rate = share of ranges containing the truth (inclusive); interval overconfidence = 0.90 − hit rate. AUROC (exploratory). Definitions and test vectors: `analysis/test_vectors.json`.

**Hypotheses.**
- H1 (replication). (a) Overconfidence > 0 in both languages (one-sided). (b) Interval hit rate < 0.90 in both languages (one-sided). (c) Hard–easy effect: across items, item accuracy and item overconfidence are negatively correlated (Spearman, one-sided).
- H2 (test-language difference). Participant-level overconfidence differs between zh-test and en-test sessions (two-sided; the literature is mixed, no direction predicted). Analysis: regression of overconfidence on test language with available covariates (age band, education, region). Run first with all items, then excluding DIF-flagged items (below). Both results reported.
- H3 (foreign-language effect, within-subject). Among participants who complete both languages, overconfidence is lower in the self-reported non-native language than in the native language. Paired difference with bootstrap 95% CI; smallest effect size of interest = 2 percentage points; the order of languages is self-selected (participants choose their first language), so order is entered as a covariate and the effect is also reported separately for the native-first and non-native-first subgroups. A null is reported as a null.
- Exploratory (labelled as such in all reports): age band, education, region; relation between two-alternative and interval overconfidence (format effect); comparison with language models answering identical items.

**Item fairness (before H2).** For each two-alternative item: logistic DIF, correct ~ total score + language + total score × language; flag if Zumbo ΔR² ≥ 0.035. For each interval item: flag if the median absolute log-ratio error differs between languages by more than 0.5 after matching on total score. Flagged items are listed in the report.

**Timing and sample size.** First confirmatory analysis when passed sessions ≥ 5,000 in total and ≥ 2,000 per language; H3 when ≥ 500 linked bilingual pairs exist. Interim looks are for data quality only; no result-dependent stopping.

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

## Data release

Anonymous row-level data for both studies (with exclusion flags) released on OSF, Hugging Face and Kaggle with a data card describing collection, sample bias and intended use. Classroom sessions are pooled without class codes. Code for every analysis is in `analysis/`.
