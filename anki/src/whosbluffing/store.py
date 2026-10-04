"""Local SQLite store for Who's Bluffing ratings. Pure stdlib, so it is testable without Anki.

Never stores card content: card, deck and note type ids are salted SHA-256 hashes."""
import csv
import hashlib
import secrets
import sqlite3
from pathlib import Path

COLUMNS = (
    "ts", "card_hash", "deck_hash", "notetype_hash", "jol", "ease",
    "q_rt_ms", "a_rt_ms", "ivl_days", "reps", "lapses", "days_since_last_review",
    "stability", "difficulty", "retrievability", "anki_version", "addon_version",
)

SCHEMA = """
CREATE TABLE IF NOT EXISTS ratings (
    id INTEGER PRIMARY KEY,
    ts TEXT NOT NULL,
    card_hash TEXT NOT NULL,
    deck_hash TEXT NOT NULL,
    notetype_hash TEXT NOT NULL,
    jol INTEGER NOT NULL CHECK (jol BETWEEN 1 AND 5),
    ease INTEGER NOT NULL CHECK (ease BETWEEN 1 AND 4),
    q_rt_ms INTEGER,
    a_rt_ms INTEGER,
    ivl_days INTEGER,
    reps INTEGER,
    lapses INTEGER,
    days_since_last_review REAL,
    stability REAL,
    difficulty REAL,
    retrievability REAL,
    anki_version TEXT,
    addon_version TEXT
);
CREATE TABLE IF NOT EXISTS meta (key TEXT PRIMARY KEY, value TEXT NOT NULL);
"""


def connect(path: str | Path) -> sqlite3.Connection:
    """Open (and create if needed) the database; the per-install salt is made on first open."""
    path = Path(path)
    path.parent.mkdir(parents=True, exist_ok=True)
    conn = sqlite3.connect(path, isolation_level=None)  # autocommit: each row is durable at once
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA journal_mode=WAL")
    conn.executescript(SCHEMA)
    conn.execute("INSERT OR IGNORE INTO meta VALUES ('salt', ?)", (secrets.token_hex(16),))
    return conn


def salt(conn: sqlite3.Connection) -> str:
    return conn.execute("SELECT value FROM meta WHERE key = 'salt'").fetchone()[0]


def hash_id(salt: str, value: object) -> str:
    return hashlib.sha256(f"{value}{salt}".encode()).hexdigest()


def insert_rating(conn: sqlite3.Connection, row: dict) -> None:
    """Insert one rating. The row must have exactly COLUMNS, so nothing else can slip in."""
    if set(row) != set(COLUMNS):
        raise ValueError(f"rating row keys differ from COLUMNS: {sorted(set(row) ^ set(COLUMNS))}")
    conn.execute(
        f"INSERT INTO ratings ({', '.join(COLUMNS)}) VALUES ({', '.join('?' * len(COLUMNS))})",
        [row[c] for c in COLUMNS],
    )


def bump(conn: sqlite3.Connection, key: str) -> None:
    conn.execute(
        "INSERT INTO meta VALUES (?, '1') "
        "ON CONFLICT(key) DO UPDATE SET value = CAST(value AS INTEGER) + 1",
        (key,),
    )


def counter(conn: sqlite3.Connection, key: str) -> int:
    return int(get_meta(conn, key) or 0)


def get_meta(conn: sqlite3.Connection, key: str) -> str | None:
    row = conn.execute("SELECT value FROM meta WHERE key = ?", (key,)).fetchone()
    return row[0] if row else None


def set_meta(conn: sqlite3.Connection, key: str, value: object) -> None:
    conn.execute("INSERT INTO meta VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value", (key, str(value)))


def rows(conn: sqlite3.Connection) -> list[dict]:
    return [dict(r) for r in conn.execute(f"SELECT {', '.join(COLUMNS)} FROM ratings ORDER BY id")]


def export_csv(conn: sqlite3.Connection, path: str | Path) -> int:
    """Write every rating row to a CSV file; returns the number of rows."""
    data = rows(conn)
    with open(path, "w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=COLUMNS)
        writer.writeheader()
        writer.writerows(data)
    return len(data)
