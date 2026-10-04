"""Offline tests for apply_factcheck.py on a synthetic pool and report, plus a check that the 2026-10-04 report has a
decision for every CHECK row.

    python3 -m unittest discover -s analysis/items_pipeline        (also run by `npm test` in web/)
"""
import json
import os
import sys
import unittest

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
import apply_factcheck as A  # noqa: E402

WD = "https://www.wikidata.org/wiki/"


def item(i, answer=100, source=None, **kw):
    return dict({"id": i, "answer": answer, "source": source or f"{WD}Q{i[1:]}#P1", "fact_checked": False}, **kw)


def row(i, verdict, better=None, source=None, note="n"):
    return {"id": i, "verdict": verdict, "our_value": 100, "better_value": better, "better_source": source, "note": note}


class Apply(unittest.TestCase):
    def test_each_verdict_and_decision(self):
        items = [item("w9001"), item("w9002"), item("w0175", 439), item("w0025"), item("w1643"), item("w9003", notes="older note")]
        report = {"_file": "factcheck-test.json", "items": [
            row("w9001", "OK"),
            row("w9002", "WRONG", 1963, "http://web.archive.org/web/1/https://example.org/a", "1948 was the tractor firm"),
            row("w0175", "CHECK", 431, "https://example.org/un", "UN DYB 431"),
            row("w0025", "CHECK", 22072, "https://example.org/cbs", "definition"),
            row("w1643", "CHECK", None, None, "call sign"),
            row("w9003", "OK"),
        ]}
        out, counts = A.apply(items, report, "2026-10-04")
        by = {it["id"]: it for it in out}
        self.assertEqual(counts, {"ok": 2, "corrected": 2, "ambiguous": 1, "retired": 1})
        self.assertTrue(by["w9001"]["fact_checked"] and "fact-check factcheck-test.json (2026-10-04): OK" in by["w9001"]["notes"])
        wrong = by["w9002"]
        self.assertEqual((wrong["answer"], wrong["source"], wrong["replaces"], wrong["fact_checked"]),
                         (1963, "https://web.archive.org/web/1/https://example.org/a", f"{WD}Q9002#P1", True))
        self.assertIn("WRONG, was 100: 1948 was the tractor firm", wrong["notes"])
        self.assertEqual((by["w0175"]["answer"], by["w0175"]["fact_checked"]), (431, True))  # small gap: adopted
        self.assertEqual((by["w0025"]["answer"], by["w0025"]["ranked_ok"], by["w0025"]["fact_checked"]), (100, False, False))
        self.assertEqual((by["w1643"]["retired_at"], by["w1643"]["ranked_ok"]), ("2026-10-04", False))
        self.assertTrue(by["w9003"]["notes"].startswith("older note | fact-check"))
        again, counts2 = A.apply(out, report, "2026-10-05")
        self.assertEqual((again, counts2), (out, {"already applied": 6}))  # idempotent

    def test_unknown_ids_and_undecided_checks_are_errors(self):
        with self.assertRaisesRegex(ValueError, "not in the pool"):
            A.apply([item("w1")], {"items": [row("w2", "OK")]})
        with self.assertRaisesRegex(ValueError, "no decision"):
            A.apply([item("w9")], {"items": [row("w9", "CHECK", 1, "https://x")]})

    def test_the_2026_10_04_report_has_a_decision_for_every_check_row(self):
        with open(A.DEFAULT_REPORT) as f:
            report = json.load(f)
        checks = {r["id"] for r in report["items"] if r["verdict"] == "CHECK"}
        decided = set(A.AMBIGUOUS) | set(A.ADOPT) | set(A.RETIRE)
        self.assertEqual(checks, decided)
        self.assertFalse(set(A.AMBIGUOUS) & set(A.ADOPT) or set(A.ADOPT) & set(A.RETIRE) or set(A.AMBIGUOUS) & set(A.RETIRE))
        self.assertEqual((len(A.AMBIGUOUS), len(A.ADOPT), len(A.RETIRE)), (25, 8, 1))


if __name__ == "__main__":
    unittest.main()
