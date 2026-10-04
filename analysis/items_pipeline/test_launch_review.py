"""Offline test for launch_review.py's flags on a tiny synthetic day.

    python3 -m unittest discover -s analysis/items_pipeline        (also run by `npm test` in web/)
"""
import os
import sys
import unittest

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import launch_review as L  # noqa: E402

WD = "https://www.wikidata.org/wiki/"


def item(i, name, answer, category="country_population", unit="people", prompt=None, notes=None):
    it = {"id": i, "name": name, "answer": answer, "category": category, "source": f"{WD}Q{i[1:]}#P1",
          "en": {"prompt": prompt or f"What was the population of {name} in 2024?", "unit": unit}}
    return dict(it, notes=notes) if notes else it


class Flags(unittest.TestCase):
    def test_flags(self):
        pool = [item("w1", "Yemen", 28250420, prompt="What was the population of Yemen in 2017?"), item("w2", "Poland", 37563071),
                item("w3", "Pepsi", 1893, "product_released", "year", "x", "curated launch year: first sold in 1893 (renamed Pepsi-Cola in 1898)"),
                item("w4", "Lego", 1958, "product_released", "year", "x", "fact-check factcheck-famous-2026-10-04.json (2026-10-04): OK"),
                item("w5", "Mercury", 4879, "solar_system_size", "km", "x"), item("w6", "mercury", -38.8, "element_melting_point", "°C", "x")]
        pairs = [{"id": "p1", "a_id": "w1", "b_id": "w2", "truth": 1, "ratio": 1.33, "prompt": "Which country has more people?",
                  "unit": "people", "category": "country_population", "difficulty_hint": "hard"},
                 {"id": "p2", "a_id": "w3", "b_id": "w4", "truth": 0, "ratio": None, "prompt": "Which came out first?",
                  "unit": "year", "category": "product_released", "difficulty_hint": "easy"}]
        rounds = {"2026-10-04": {"ranked": ["p1"], "question": "p2"}, "2026-10-09": {"ranked": ["p1"], "question": "p2"},
                  "2026-10-11": {"ranked": ["p2"], "question": "p1"}}
        text = L.review(pool, pairs, rounds, "2026-10-04", "2026-10-04")
        self.assertIn("stale: figures from Yemen 2017", text)
        self.assertIn("stale: figures from different years (2017 vs 2024)", text)
        self.assertIn("close: hard pair (ratio 1.33) on estimated figures", text)
        self.assertIn("contested: Pepsi launch year depends on the event", text)
        self.assertNotIn("contested: Lego", text)  # an OK fact-check is not a flag
        self.assertIn("repeat: Yemen also on 2026-10-09", text)  # 5 days later
        self.assertNotIn("2026-10-11", text.split("## 2026-10-04")[1].split("|")[-2])  # 7 days away is not "in one week"
        self.assertEqual(L.fmt(-2560, "year"), "2560 BC")
        names = {L.norm_name(it["name"]): set() for it in pool}
        for it in pool:
            names[L.norm_name(it["name"])].add(L.entity(it))
        self.assertEqual(len(names["mercury"]), 2)  # the planet and the element share a name: "ambiguous"


if __name__ == "__main__":
    unittest.main()
