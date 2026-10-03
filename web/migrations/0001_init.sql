-- One row per completed session. answers = JSON array (validated input plus server-computed correct/hit).
CREATE TABLE sessions (
  id TEXT PRIMARY KEY,
  created_at TEXT NOT NULL,
  lang TEXT NOT NULL,
  country TEXT,
  class_code TEXT,
  first_session_id TEXT,
  demographics TEXT,
  answers TEXT NOT NULL,
  n_2afc INTEGER,
  n_interval INTEGER,
  acc REAL,
  mean_conf REAL,
  overconf REAL,
  brier REAL,
  auroc REAL,
  int_hit REAL,
  passed_attention INTEGER,
  total_rt_ms INTEGER
);
CREATE INDEX idx_sessions_lang_passed ON sessions(lang, passed_attention);
CREATE INDEX idx_sessions_class ON sessions(class_code);

CREATE TABLE classes (
  code TEXT PRIMARY KEY,
  secret TEXT UNIQUE,
  label TEXT,
  created_at TEXT
);
