"""Reference calibration metrics for HowSure. The JS (web) and Python (anki)
implementations must reproduce analysis/test_vectors.json, which this file generates.
conf is a probability in [0.5, 1.0]; correct is 0/1."""
import json, sys
from pathlib import Path

def mean(xs): return sum(xs) / len(xs) if xs else None

def overconfidence(conf, correct):
    return None if not conf else mean(conf) - mean(correct)

def brier(conf, correct):
    return None if not conf else mean([(c - y) ** 2 for c, y in zip(conf, correct)])

def auroc(conf, correct):
    pos = [c for c, y in zip(conf, correct) if y == 1]
    neg = [c for c, y in zip(conf, correct) if y == 0]
    if not pos or not neg: return None
    s = 0.0
    for p in pos:
        for q in neg:
            s += 1.0 if p > q else 0.5 if p == q else 0.0
    return s / (len(pos) * len(neg))

def bins(conf, correct, levels=(0.5, 0.6, 0.7, 0.8, 0.9, 1.0)):
    out = []
    for lv in levels:
        ys = [y for c, y in zip(conf, correct) if abs(c - lv) < 1e-9]
        out.append({"conf": lv, "n": len(ys), "acc": mean(ys)})
    return out

def interval_hit_rate(low, high, truth):
    hits = [1 if l <= t <= h else 0 for l, h, t in zip(low, high, truth)]
    return None if not hits else mean(hits)

def interval_overconfidence(low, high, truth, nominal=0.9):
    h = interval_hit_rate(low, high, truth)
    return None if h is None else nominal - h

def r6(x): return None if x is None else round(x, 6)

def main():
    cases = []
    def add(name, conf=None, correct=None, low=None, high=None, truth=None, hand=None):
        case = {"name": name}
        if conf is not None:
            case["input"] = {"conf": conf, "correct": correct}
            case["expected"] = {"overconfidence": r6(overconfidence(conf, correct)), "brier": r6(brier(conf, correct)),
                                "auroc": r6(auroc(conf, correct)),
                                "bins": [{"conf": b["conf"], "n": b["n"], "acc": r6(b["acc"])} for b in bins(conf, correct)]}
        else:
            case["input"] = {"low": low, "high": high, "truth": truth}
            case["expected"] = {"interval_hit_rate": r6(interval_hit_rate(low, high, truth)),
                                "interval_overconfidence": r6(interval_overconfidence(low, high, truth))}
        if hand:
            for k, v in hand.items():
                assert abs(case["expected"][k] - v) < 1e-6, (name, k, case["expected"][k], v)
        cases.append(case)
    add("2afc_basic", [0.5, 0.6, 0.7, 0.8, 0.9, 1.0], [1, 0, 1, 1, 0, 1],
        hand={"overconfidence": 0.083333, "brier": 0.258333, "auroc": 0.5})
    add("2afc_ties", [0.9, 0.9, 0.9, 0.6], [1, 1, 0, 0], hand={"overconfidence": 0.325, "brier": 0.2975, "auroc": 0.75})
    add("2afc_all_correct_auroc_null", [0.7, 1.0], [1, 1], hand={"overconfidence": -0.15, "brier": 0.045})
    add("2afc_perfect_calibration", [0.5, 0.5, 1.0, 1.0], [1, 0, 1, 1], hand={"overconfidence": 0.0})
    add("interval_basic", low=[1, 0, 100, -5, 3], high=[10, 1, 200, 5, 3], truth=[5, 2, 100, 6, 3],
        hand={"interval_hit_rate": 0.6, "interval_overconfidence": 0.3})
    add("interval_all_hit", low=[0, 0], high=[1, 1], truth=[0, 1], hand={"interval_hit_rate": 1.0, "interval_overconfidence": -0.1})
    empty = {"name": "empty_inputs", "input": {"conf": [], "correct": []},
             "expected": {"overconfidence": None, "brier": None, "auroc": None}}
    cases.append(empty)
    out = {"version": 1, "conf_scale": "probability 0.5-1.0 (UI shows 50-100%)", "nominal_interval": 0.9,
           "auroc_ties": 0.5, "interval_inclusive": True, "cases": cases}
    Path(__file__).with_name("test_vectors.json").write_text(json.dumps(out, indent=2, ensure_ascii=False) + "\n")
    print(f"wrote {len(cases)} cases; hand checks passed")

if __name__ == "__main__":
    main()
