"""Offline tests for pairs.py: the pair rules, stable ids and a/b order, the per-item cap, the truth balance, and the
ranked-round / chat-question builder. Synthetic pools only; never touches the repo's files.

    python3 -m unittest discover -s analysis/items_pipeline        (also run by `npm test` in web/)
"""
import json
import os
import sys
import tempfile
import unittest

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
import pairs as P  # noqa: E402

UNITS = {"river_length": "km", "mountain_elevation": "m", "building_height": "m", "bridge_length": "m", "country_area": "km²",
         "element_melting_point": "°C", "first_flight": "year", "first_ascent": "year", "city_population": "people",
         "university_founded": "year", "solar_system_size": "km"}


def item(n, category, answer, ref="referenced", unit=None, **extra):
    unit = unit or UNITS[category]
    it = {"id": f"w{n:04d}", "category": category, "en": {"prompt": f"Question {n}?", "unit": unit}, "answer": answer,
          "name": f"thing {n}", "ref_quality": ref, "fact_checked": False, "volatile": False}
    it.update(extra)
    return it


def spread_pool(categories, per_category, start=1, ref="referenced"):
    """Values 1.06^k apart within each category: every difficulty class has plenty of pairs."""
    items, n = [], start
    for c in categories:
        for k in range(per_category):
            unit = UNITS[c]
            answer = 1800 + k if unit == "year" else round(100 * 1.06 ** k, 2)
            items.append(item(n, c, answer, ref))
            n += 1
    return items


def pairs_of(items, **kw):
    return P.build_pairs(items, generated_at="2026-10-03", **kw)[0]["pairs"]


class Rules(unittest.TestCase):
    def test_ratio_of_at_least_1_3_within_one_category_and_unit(self):
        items = [item(1, "river_length", 100), item(2, "river_length", 129), item(3, "river_length", 130),
                 item(4, "bridge_length", 300), item(5, "mountain_elevation", 400)]
        got = {tuple(sorted((p["a_id"], p["b_id"]))) for p in pairs_of(items)}
        self.assertEqual(got, {("w0001", "w0003"), ("w0002", "w0004")} - {("w0002", "w0004")})  # 129/100 < 1.3; other categories never mix
        lake = [item(1, "river_length", 10, unit="km"), item(2, "river_length", 100, unit="m")]
        lake[0]["category"] = lake[1]["category"] = "lake"
        self.assertEqual(pairs_of(lake), [])  # same category, different unit (area vs depth)

    def test_difficulty_from_ratio_and_from_year_gap(self):
        self.assertEqual([P.difficulty(ratio=r) for r in (3, 2.99, 1.6, 1.59, 1.3)], ["easy", "medium", "medium", "hard", "hard"])
        self.assertEqual([P.difficulty(gap=g) for g in (50, 49, 20, 19, 10)], ["easy", "medium", "medium", "hard", "hard"])

    def test_melting_points_compare_in_kelvin(self):
        items = [item(1, "element_melting_point", -38.8), item(2, "element_melting_point", 0), item(3, "element_melting_point", 100)]
        got = {(p["a_id"], p["b_id"]) if p["a_id"] < p["b_id"] else (p["b_id"], p["a_id"]): p for p in pairs_of(items)}
        # 373.15 K / 234.35 K = 1.59 and 373.15 / 273.15 = 1.37 pair; 0 °C vs -38.8 °C is only 1.17 (in Celsius: undefined)
        self.assertEqual(set(got), {("w0001", "w0003"), ("w0002", "w0003")})
        p = got[("w0001", "w0003")]
        self.assertEqual((p["ratio"], p["difficulty_hint"], p["prompt"]), (1.592, "hard", "Which melts at a higher temperature?"))
        self.assertEqual([p["a_id"], p["b_id"]][p["truth"]], "w0003")  # 100 °C melts hotter
        self.assertEqual(got[("w0002", "w0003")]["ratio"], 1.366)

    def test_years_need_a_ten_year_gap_and_the_earlier_one_is_right(self):
        items = [item(1, "first_flight", 1969), item(2, "first_flight", 1960), item(3, "first_flight", 1959)]
        ps = pairs_of(items)
        self.assertEqual(len(ps), 1)  # 1969-1960 = 9 years: too close; 1969-1959 = 10
        p = ps[0]
        self.assertEqual((p["ratio"], p["gap"], p["difficulty_hint"], p["prompt"], p["unit"]), (None, 10, "hard", "Which came first?", "year"))
        self.assertEqual([p["a_id"], p["b_id"]][p["truth"]], "w0003")
        uni = pairs_of([item(1, "university_founded", 1636), item(2, "university_founded", 1088)])[0]
        self.assertEqual((uni["prompt"], [uni["a_id"], uni["b_id"]][uni["truth"]], uni["difficulty_hint"]), ("Which was founded first?", "w0002", "easy"))
        self.assertEqual(pairs_of([item(1, "first_ascent", 1953), item(2, "first_ascent", 1865)])[0]["prompt"], "Which was first climbed earlier?")

    def test_exclusions(self):
        base = [item(1, "river_length", 100), item(2, "river_length", 1000)]
        cases = {
            "city populations": [item(1, "city_population", 1e6), item(2, "city_population", 5e6)],
            "volatile": [base[0], dict(base[1], volatile=True)],
            "disputed": [item(52, "country_area", 88499), item(1, "country_area", 1000)],
            "no name": [base[0], dict(base[1], name="")],
            "not positive": [item(1, "mountain_elevation", 0), item(2, "mountain_elevation", 4000)],
            "a moon of a dwarf planet": [item(1, "solar_system_size", 1000), item(2, "solar_system_size", 5000)],
        }
        cases["a moon of a dwarf planet"] = [
            dict(item(1, "solar_system_size", 19591, unit="km"), category="solar_system_distance", en={"prompt": "On average, how far is Charon from Pluto?", "unit": "km"}),
            dict(item(2, "solar_system_size", 384400, unit="km"), category="solar_system_distance", en={"prompt": "On average, how far is the Moon from Earth?", "unit": "km"}),
        ]
        for name, items in cases.items():
            self.assertEqual(pairs_of(items), [], name)
        self.assertEqual(pairs_of(base, retired={"w0002"}), [])
        self.assertEqual(len(pairs_of(base)), 1)
        self.assertIn("w0052", P.DISPUTED)

    def test_no_item_in_more_than_25_pairs_and_the_cap_is_nearly_filled(self):
        ps = pairs_of(spread_pool(["river_length", "country_area"], 120))
        degree = {}
        for p in ps:
            for i in (p["a_id"], p["b_id"]):
                degree[i] = degree.get(i, 0) + 1
        self.assertEqual(max(degree.values()), 25)
        self.assertGreater(len(ps), 0.95 * 240 * 25 / 2)  # greedy, but close to the ceiling of 3,000
        levels = {lv: sum(p["difficulty_hint"] == lv for p in ps) for lv in ("easy", "medium", "hard")}
        self.assertTrue(all(n > 0.15 * len(ps) for n in levels.values()), levels)  # interleaving keeps every class

    def test_truth_is_a_about_half_the_time_and_always_the_larger_value(self):
        items = spread_pool(["river_length", "building_height", "first_flight"], 80)
        ps = pairs_of(items)
        share = sum(p["truth"] == 0 for p in ps) / len(ps)
        self.assertLess(abs(share - 0.5), 0.03, share)
        value = {it["id"]: it["answer"] for it in items}
        for p in ps:
            a, b = value[p["a_id"]], value[p["b_id"]]
            right = (a < b) if p["unit"] == "year" else (a > b)
            self.assertEqual(p["truth"], 0 if right else 1, p)

    def test_pair_records_and_reference_quality(self):
        items = [item(1, "river_length", 6650, name="the Nile"), item(2, "river_length", 2850, "imported", name="the Danube"),
                 item(3, "river_length", 1233, "none", name="the Rhine", fact_checked=True)]
        ps = {frozenset((p["a_id"], p["b_id"])): p for p in pairs_of(items)}
        p = ps[frozenset(("w0001", "w0002"))]
        self.assertEqual(set(p), {"id", "a_id", "b_id", "truth", "ratio", "prompt", "a", "b", "unit", "category", "difficulty_hint", "ref_quality"})
        self.assertEqual({p["a"], p["b"]}, {"the Nile", "the Danube"})
        self.assertEqual((p["prompt"], p["unit"], p["category"], p["ratio"], p["difficulty_hint"]), ("Which is longer?", "km", "river_length", 2.333, "medium"))
        self.assertEqual(p["ref_quality"], "imported")  # the weaker item
        self.assertEqual(ps[frozenset(("w0001", "w0003"))]["ref_quality"], "referenced")  # fact-checked counts as referenced
        self.assertRegex(p["id"], r"^p\d{5}$")


class Stability(unittest.TestCase):
    def test_ids_and_a_b_order_survive_a_rebuild_and_new_pairs_get_new_ids(self):
        items = spread_pool(["river_length"], 40)
        first = pairs_of(items)
        flipped = [dict(p, a_id=p["b_id"], b_id=p["a_id"], a=p["b"], b=p["a"], truth=1 - p["truth"]) for p in first[:5]]
        previous = flipped + first[5:]  # whatever order was stored is kept
        second = pairs_of(items + spread_pool(["bridge_length"], 30, start=500), previous=previous)
        old = {p["id"]: p for p in previous}
        for p in second:
            if p["id"] in old:
                self.assertEqual((p["a_id"], p["b_id"], p["truth"]), (old[p["id"]]["a_id"], old[p["id"]]["b_id"], old[p["id"]]["truth"]))
        self.assertTrue(set(old) <= {p["id"] for p in second})
        new = [p for p in second if p["id"] not in old]
        self.assertTrue(new and min(int(p["id"][1:]) for p in new) == max(int(i[1:]) for i in old) + 1)

    def test_scheduled_pairs_are_carried_when_they_no_longer_qualify(self):
        items = [item(1, "river_length", 100), item(2, "river_length", 1000)]
        first = pairs_of(items)
        retired_now = pairs_of(items, previous=first, retired={"w0002"}, scheduled={first[0]["id"]})
        self.assertEqual([p["id"] for p in retired_now], [first[0]["id"]])
        self.assertEqual(pairs_of(items, previous=first, retired={"w0002"}), [])


class Rounds(unittest.TestCase):
    CATS = ["river_length", "mountain_elevation", "building_height", "bridge_length", "country_area", "first_flight"]

    @classmethod
    def setUpClass(cls):
        cls.items = spread_pool(cls.CATS, 120)
        cls.pairs = pairs_of(cls.items)
        cls.by_id = {p["id"]: p for p in cls.pairs}
        cls.rounds = P.extend_rounds(cls.pairs, {}, "2026-10-03", days=60)

    def test_ten_ranked_and_a_question_every_day_with_the_mix_and_category_limit(self):
        self.assertEqual(len(self.rounds), 61)
        self.assertEqual((min(self.rounds), max(self.rounds)), ("2026-10-03", "2026-12-02"))
        for date, e in self.rounds.items():
            ranked = [self.by_id[i] for i in e["ranked"]]
            self.assertEqual(len(ranked), 10, date)
            self.assertEqual(sorted(p["difficulty_hint"] for p in ranked), ["easy"] * 3 + ["hard"] * 3 + ["medium"] * 4, date)
            cats = [p["category"] for p in ranked]
            self.assertLessEqual(max(cats.count(c) for c in cats), 2, date)
            q = self.by_id[e["question"]]
            self.assertNotIn(q["id"], e["ranked"])
            self.assertEqual(q["difficulty_hint"], "medium")
            day_items = [i for p in ranked + [q] for i in (p["a_id"], p["b_id"])]
            self.assertEqual(len(set(day_items)), 22, date)

    def test_only_referenced_pairs_and_no_reuse_within_180_days_for_pairs_or_25_for_items(self):
        pair_dates, item_dates = {}, {}
        for date, e in self.rounds.items():
            for pid in P.day_pairs(e):
                p = self.by_id[pid]
                self.assertEqual(p["ref_quality"], "referenced")
                pair_dates.setdefault(pid, []).append(date)
                for i in (p["a_id"], p["b_id"]):
                    item_dates.setdefault(i, []).append(date)
        for dates in pair_dates.values():
            self.assertEqual(len(dates), 1)  # 61 days < 180
        for i, dates in item_dates.items():
            dates.sort()
            for a, b in zip(dates, dates[1:]):
                self.assertGreaterEqual(P.days_between(a, b), P.ITEM_NO_REUSE_DAYS, i)
        self.assertEqual(P.ITEM_NO_REUSE_DAYS, 25)

    def test_unreferenced_pairs_never_enter_and_too_few_pairs_is_an_error(self):
        mixed = spread_pool(self.CATS, 120, ref="imported")
        mixed_pairs = pairs_of(mixed)
        with self.assertRaises(ValueError):
            P.extend_rounds(mixed_pairs, {}, "2026-10-03", days=1)
        tiny = pairs_of(spread_pool(self.CATS[:2], 30))
        with self.assertRaisesRegex(ValueError, "not enough eligible"):
            P.extend_rounds(tiny, {}, "2026-10-03", days=60)

    def test_append_only_existing_days_are_kept_and_count_for_reuse(self):
        existing = {d: e for d, e in self.rounds.items() if d <= "2026-10-05"}
        again = P.extend_rounds(self.pairs, existing, "2026-10-04", days=10)
        for d, e in existing.items():
            self.assertEqual(again[d], e)
        self.assertEqual((min(again), max(again)), ("2026-10-03", "2026-10-14"))
        used = {i for d, e in existing.items() for i in P.day_pairs(e)}
        later = {i for d, e in again.items() if d > "2026-10-05" for i in P.day_pairs(e)}
        self.assertFalse(used & later)
        self.assertEqual(P.extend_rounds(self.pairs, {}, "2026-10-03", days=60), self.rounds)  # seeded by date

    def test_one_entity_at_most_once_a_day_and_well_known_items_first(self):
        twin = {it["id"]: f"Q{n // 2}" for n, it in enumerate(self.items)}  # every two items are about one entity
        redo = P.extend_rounds(self.pairs, {}, "2026-10-03", days=10, entity_of=twin)
        for date, e in redo.items():
            ents = [twin.get(i, i) for pid in P.day_pairs(e) for i in (self.by_id[pid]["a_id"], self.by_id[pid]["b_id"])]
            self.assertEqual(len(ents), len(set(ents)), date)
        self.assertEqual(P.entity({"id": "w1", "source": "https://www.wikidata.org/wiki/Q3392#P2043"}), "Q3392")
        self.assertEqual(P.entity({"id": "w2", "source": "https://x.org/a", "replaces": "https://www.wikidata.org/wiki/Q9#P1"}), "Q9")
        self.assertEqual(P.entity({"id": "w3", "source": "https://x.org/a"}), "w3")
        known = {it["id"]: (1000 if it["category"] == "river_length" else 10) for it in self.items}
        day = P.extend_rounds(self.pairs, {}, "2026-10-03", days=0, popularity=known)["2026-10-03"]
        cats = [self.by_id[pid]["category"] for pid in day["ranked"]]
        self.assertEqual(cats.count("river_length"), 2)  # the well-known category fills its 2 slots

    def test_retired_pairs_are_not_scheduled(self):
        some = set(self.rounds["2026-10-03"]["ranked"][:3])
        redo = P.extend_rounds(self.pairs, {}, "2026-10-03", days=5, retired_pairs=some)
        self.assertFalse(some & {i for e in redo.values() for i in P.day_pairs(e)})


class Files(unittest.TestCase):
    def test_formats_round_trip_and_main_writes_pairs_rounds_and_review(self):
        rounds = {"2026-10-03": {"ranked": [f"p{i:05d}" for i in range(1, 11)], "question": "p00011"}}
        text = P.format_rounds(rounds)
        self.assertEqual(json.loads(text), rounds)
        self.assertEqual(text.count("\n"), 3)  # one line per day
        with tempfile.TemporaryDirectory() as tmp:
            pool = os.path.join(tmp, "pool.json")
            with open(pool, "w") as f:  # 121 days x 22 items with a 25-day gap need more than 550 items
                json.dump({"version": 1, "items": spread_pool(Rounds.CATS + ["first_ascent", "university_founded"], 120)}, f)
            out, rnd = os.path.join(tmp, "pairs.json"), os.path.join(tmp, "rounds.json")
            args = ["--pool", pool, "--out", out, "--rounds", rnd, "--runtime", os.path.join(tmp, "none.json"),
                    "--pair-runtime", os.path.join(tmp, "none2.json"), "--today", "2026-10-03"]
            from contextlib import redirect_stderr
            import io
            with redirect_stderr(io.StringIO()):
                self.assertEqual(P.main(args), 0)
            with open(out) as f:
                doc = json.load(f)
            self.assertEqual({(t["category"], t["unit"]) for t in doc["templates"]}, set(P.TEMPLATES))
            self.assertGreater(len(doc["pairs"]), 5000)
            with open(rnd) as f:
                self.assertEqual(len(json.load(f)), 121)
            with open(os.path.join(tmp, "pairs.REVIEW.md")) as f:
                self.assertIn(f"**Total: {len(doc['pairs'])} pairs**", f.read())
            with redirect_stderr(io.StringIO()):
                self.assertEqual(P.main(args), 0)  # a re-run keeps every id and every day
            with open(out) as f:
                self.assertEqual(json.load(f)["pairs"], doc["pairs"])


if __name__ == "__main__":
    unittest.main()
