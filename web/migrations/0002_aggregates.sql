-- Running aggregates over passed sessions (passed_attention = 1). submit.js updates them in the same D1 batch
-- (one transaction) as the session insert, so stats and percentiles never scan the sessions table.
-- No backfill: apply this before any real session is stored (nothing is deployed yet).

CREATE TABLE agg_totals (
  lang TEXT PRIMARY KEY,
  n_sessions INTEGER NOT NULL,
  n_answers INTEGER NOT NULL,
  sum_overconf REAL NOT NULL,
  sum_int_hit REAL NOT NULL
);

-- metric 'overconf': bin = round(overconf * 20), 0.05 wide, clamped to [-10, 10]; metric 'int_hit': bin = round(int_hit * 6), 0..6.
CREATE TABLE agg_hist (
  lang TEXT NOT NULL,
  metric TEXT NOT NULL,
  bin INTEGER NOT NULL,
  n INTEGER NOT NULL,
  PRIMARY KEY (lang, metric, bin)
);

-- Global calibration curve: two-alternative answers per confidence level (50..100).
CREATE TABLE agg_bins (
  lang TEXT NOT NULL,
  conf INTEGER NOT NULL,
  n INTEGER NOT NULL,
  correct INTEGER NOT NULL,
  PRIMARY KEY (lang, conf)
);

CREATE TABLE agg_country (
  country TEXT PRIMARY KEY,
  n INTEGER NOT NULL
);
