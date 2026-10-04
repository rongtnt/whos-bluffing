"""Calibration metrics for Who's Bluffing. Pure stdlib so the analysis code can import it later.

Must reproduce analysis/test_vectors.json: conf is a probability in [0.5, 1.0],
correct is 0/1, AUROC counts ties as 0.5 and is None with only one class,
interval hits are inclusive."""
from collections import defaultdict
from collections.abc import Sequence
from datetime import date, datetime, timedelta

LEVELS = (0.5, 0.6, 0.7, 0.8, 0.9, 1.0)
# Anki ratings 1..5 -> confidence. Stated in the dashboard footnote and the README.
JOL_CONF = {1: 0.5, 2: 0.625, 3: 0.75, 4: 0.875, 5: 1.0}


def mean(xs: Sequence[float]) -> float | None:
    return sum(xs) / len(xs) if xs else None


def overconfidence(conf: Sequence[float], correct: Sequence[int]) -> float | None:
    return None if not conf else mean(conf) - mean(correct)


def brier(conf: Sequence[float], correct: Sequence[int]) -> float | None:
    return None if not conf else mean([(c - y) ** 2 for c, y in zip(conf, correct)])


def auroc(conf: Sequence[float], correct: Sequence[int]) -> float | None:
    """Mann-Whitney AUROC with average ranks (ties count 0.5); O(n log n)."""
    n_pos = sum(correct)
    n_neg = len(correct) - n_pos
    if not n_pos or not n_neg:
        return None
    order = sorted(range(len(conf)), key=conf.__getitem__)
    rank_sum, i = 0.0, 0
    while i < len(order):
        j = i
        while j + 1 < len(order) and conf[order[j + 1]] == conf[order[i]]:
            j += 1
        avg_rank = (i + j) / 2 + 1  # 1-based rank shared by the tie group
        rank_sum += avg_rank * sum(correct[k] for k in order[i:j + 1])
        i = j + 1
    return (rank_sum - n_pos * (n_pos + 1) / 2) / (n_pos * n_neg)


def bins(conf: Sequence[float], correct: Sequence[int], levels: Sequence[float] = LEVELS) -> list[dict]:
    out = []
    for level in levels:
        ys = [y for c, y in zip(conf, correct) if abs(c - level) < 1e-9]
        out.append({"conf": level, "n": len(ys), "acc": mean(ys)})
    return out


def interval_hit_rate(low: Sequence[float], high: Sequence[float], truth: Sequence[float]) -> float | None:
    return mean([1 if lo <= t <= hi else 0 for lo, hi, t in zip(low, high, truth)])


def interval_overconfidence(low: Sequence[float], high: Sequence[float], truth: Sequence[float],
                            nominal: float = 0.9) -> float | None:
    hit = interval_hit_rate(low, high, truth)
    return None if hit is None else nominal - hit


# Anki rating rows (dicts with jol 1-5, ease 1-4, ts ISO UTC) -> dashboard summaries.

def recalled(ease: int) -> int:
    """Again (1) = forgot; Hard, Good, Easy (2-4) = remembered."""
    return 1 if ease >= 2 else 0


def summarize(rows: list[dict]) -> dict:
    conf = [JOL_CONF[r["jol"]] for r in rows]
    correct = [recalled(r["ease"]) for r in rows]
    return {
        "n": len(rows),
        "mean_jol": mean([r["jol"] for r in rows]),
        "conf": mean(conf),
        "recall": mean(correct),
        "overconfidence": overconfidence(conf, correct),
    }


def by_rating(rows: list[dict]) -> dict[int, dict]:
    return {j: summarize([r for r in rows if r["jol"] == j]) for j in JOL_CONF}


def by_key(rows: list[dict], key: str) -> dict[str, dict]:
    groups = defaultdict(list)
    for r in rows:
        groups[r[key]].append(r)
    return {k: summarize(v) for k, v in groups.items()}


def by_day(rows: list[dict], days: int = 30, today: date | None = None) -> list[tuple[date, dict]]:
    """[(local date, summary)] for the last `days` days ending today, empty days included."""
    today = today or date.today()
    groups = defaultdict(list)
    for r in rows:
        groups[datetime.fromisoformat(r["ts"]).astimezone().date()].append(r)
    window = [today - timedelta(n) for n in range(days - 1, -1, -1)]
    return [(d, summarize(groups.get(d, []))) for d in window]
