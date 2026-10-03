import json
from datetime import date, datetime, timezone
from pathlib import Path

import pytest

import metrics

VECTORS = json.loads(
    (Path(__file__).resolve().parents[2] / "analysis" / "test_vectors.json").read_text(encoding="utf-8"))


def close(got, want):
    if want is None or got is None:
        return got is want
    return abs(got - want) < 1e-6


@pytest.mark.parametrize("case", VECTORS["cases"], ids=lambda c: c["name"])
def test_vector(case):
    inp, exp = case["input"], case["expected"]
    if "conf" in inp:
        conf, correct = inp["conf"], inp["correct"]
        assert close(metrics.overconfidence(conf, correct), exp["overconfidence"])
        assert close(metrics.brier(conf, correct), exp["brier"])
        assert close(metrics.auroc(conf, correct), exp["auroc"])
        if "bins" in exp:
            got = metrics.bins(conf, correct)
            assert [(b["conf"], b["n"]) for b in got] == [(b["conf"], b["n"]) for b in exp["bins"]]
            assert all(close(g["acc"], e["acc"]) for g, e in zip(got, exp["bins"]))
    else:
        args = inp["low"], inp["high"], inp["truth"]
        assert close(metrics.interval_hit_rate(*args), exp["interval_hit_rate"])
        assert close(metrics.interval_overconfidence(*args, VECTORS["nominal_interval"]),
                     exp["interval_overconfidence"])


def test_vector_file_conventions_match_module():
    assert VECTORS["auroc_ties"] == 0.5 and VECTORS["interval_inclusive"] is True
    assert metrics.auroc([0.7, 0.7], [1, 0]) == 0.5
    assert metrics.interval_hit_rate([1], [1], [1]) == 1.0


def _ts(day):
    """Local noon of `day` as an ISO UTC string, so the local date is stable in any zone."""
    return datetime(day.year, day.month, day.day, 12).astimezone(timezone.utc).isoformat()


def test_anki_summaries():
    today = date(2026, 10, 3)
    rows = [
        {"jol": 5, "ease": 1, "deck_hash": "a", "ts": _ts(today)},   # certain, forgot
        {"jol": 5, "ease": 3, "deck_hash": "a", "ts": _ts(today)},   # certain, remembered
        {"jol": 1, "ease": 2, "deck_hash": "b", "ts": _ts(date(2026, 10, 1))},
    ]
    by_rating = metrics.by_rating(rows)
    assert by_rating[5]["n"] == 2 and by_rating[5]["recall"] == 0.5
    assert by_rating[3]["n"] == 0 and by_rating[3]["recall"] is None
    deck_a = metrics.by_key(rows, "deck_hash")["a"]
    assert deck_a["mean_jol"] == 5 and abs(deck_a["overconfidence"] - 0.5) < 1e-9
    days = metrics.by_day(rows, 30, today)
    assert len(days) == 30 and days[-1][0] == today and days[-1][1]["n"] == 2
    assert days[-3][1]["n"] == 1 and days[-2][1]["n"] == 0
