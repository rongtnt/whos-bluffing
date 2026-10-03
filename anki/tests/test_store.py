import csv
import sqlite3
from contextlib import closing

import pytest

import store


def make_row(salt, **over):
    row = {c: None for c in store.COLUMNS}
    row.update(ts="2026-10-03T12:00:00+00:00", card_hash=store.hash_id(salt, 1), deck_hash=store.hash_id(salt, 2),
               notetype_hash=store.hash_id(salt, 3), jol=4, ease=3, q_rt_ms=1500, a_rt_ms=800, ivl_days=12,
               reps=5, lapses=1, days_since_last_review=11.5, stability=14.25, difficulty=5.5,
               retrievability=0.9, anki_version="26.09.3", addon_version="0.1.0")
    row.update(over)
    return row


def test_insert_query_export_roundtrip(tmp_path):
    path = tmp_path / "user_files" / "howsure.sqlite"
    with closing(store.connect(path)) as conn:
        salt = store.salt(conn)
        full = make_row(salt)
        sparse = make_row(salt, jol=1, ease=1, days_since_last_review=None, stability=None,
                          difficulty=None, retrievability=None)
        store.insert_rating(conn, full)
        store.insert_rating(conn, sparse)
        assert store.rows(conn) == [full, sparse]
        store.bump(conn, "unrated_answers")
        store.bump(conn, "unrated_answers")
        assert store.counter(conn, "unrated_answers") == 2
        assert store.counter(conn, "never_bumped") == 0
        out = tmp_path / "export.csv"
        assert store.export_csv(conn, out) == 2
    with open(out, newline="", encoding="utf-8") as f:
        exported = list(csv.DictReader(f))
    assert exported == [{k: "" if v is None else str(v) for k, v in r.items()} for r in (full, sparse)]
    with closing(store.connect(path)) as conn:  # reopen: salt persists, WAL is on
        assert store.salt(conn) == salt
        assert conn.execute("PRAGMA journal_mode").fetchone()[0] == "wal"
        assert len(store.rows(conn)) == 2


def test_rejects_bad_rows(tmp_path):
    with closing(store.connect(tmp_path / "db.sqlite")) as conn:
        good = make_row(store.salt(conn))
        with pytest.raises(ValueError):
            store.insert_rating(conn, {"jol": 3})
        with pytest.raises(ValueError):
            store.insert_rating(conn, {**good, "front": "card text"})
        with pytest.raises(sqlite3.IntegrityError):
            store.insert_rating(conn, {**good, "jol": 6})
        with pytest.raises(sqlite3.IntegrityError):
            store.insert_rating(conn, {**good, "ease": 0})
        assert store.rows(conn) == []


def test_hash_is_salted_and_stable():
    assert store.hash_id("s1", 42) == store.hash_id("s1", 42)
    assert store.hash_id("s1", 42) != store.hash_id("s2", 42)
    assert len(store.hash_id("s1", 42)) == 64


def test_each_install_gets_its_own_salt(tmp_path):
    with closing(store.connect(tmp_path / "a.sqlite")) as a, closing(store.connect(tmp_path / "b.sqlite")) as b:
        assert store.salt(a) != store.salt(b)
