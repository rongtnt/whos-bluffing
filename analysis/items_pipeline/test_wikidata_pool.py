"""Offline tests for wikidata_pool.py: the filters, unit conversion, stable ids, and a full run on the saved SPARQL
fixture (fixtures/sparql_fixture.json, real responses trimmed from the 2026-10-03 run). Never touches the network.

    python3 -m unittest discover -s analysis/items_pipeline        (also run by `npm test` in web/)
"""
import io
import json
import os
import sys
import tempfile
import unittest
import urllib.error
from contextlib import redirect_stderr

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
import wikidata_pool as w  # noqa: E402

FIXTURE = os.path.join(HERE, "fixtures", "sparql_fixture.json")
CAT = {c["name"]: c for c in w.CATEGORIES}
WD = "http://www.wikidata.org/entity/"
NORMAL, PREFERRED, DEPRECATED = (f"http://wikiba.se/ontology#{r}Rank" for r in ("Normal", "Preferred", "Deprecated"))

with open(FIXTURE) as f:
    RAW = json.load(f)


def fixture_rows(category, label):
    return [w.flat(b) for b in RAW[category]["results"]["bindings"] if b["itemLabel"]["value"] == label]


def qty(amount, unit="Q11573", rank=NORMAL):
    return {"amount": str(amount), "unit": WD + unit, "rank": rank}


def binding(q, label, sitelinks=50, **values):
    row = {"item": WD + q, "itemLabel": label, "sitelinks": str(sitelinks), **values}
    return {k: {"type": "literal", "value": v} for k, v in row.items()}


class Filters(unittest.TestCase):
    def test_preferred_rank_wins_and_deprecated_statements_are_ignored(self):
        self.assertEqual(w.select_value(CAT["country_area"], fixture_rows("country_area", "Finland")), (338478, {}))
        self.assertEqual(w.select_value(CAT["river_length"], fixture_rows("river_length", "Nile")), (6650, {}))
        only_deprecated = [qty(5000, rank=DEPRECATED)]
        self.assertEqual(w.select_value(CAT["mountain_elevation"], only_deprecated), (None, "deprecated"))
        normal_and_deprecated = [qty(4806), qty(9999, rank=DEPRECATED)]
        self.assertEqual(w.select_value(CAT["mountain_elevation"], normal_and_deprecated), (4806, {}))

    def test_conflicting_best_values_skip_the_item(self):
        self.assertEqual(w.select_value(CAT["country_area"], fixture_rows("country_area", "Bosnia and Herzegovina")), (None, "conflict"))
        mountain = CAT["mountain_elevation"]
        self.assertEqual(w.select_value(mountain, [qty(8848), qty(8849)]), (8849, {}))  # within 2%: consistent
        self.assertEqual(w.select_value(mountain, [qty(4000), qty(4500)]), (None, "conflict"))

    def test_missing_or_unsupported_units_skip_the_item(self):
        self.assertEqual(w.select_value(CAT["lake_area"], fixture_rows("lake_area", "Lake Chaubunagungamaug")), (None, "unit"))  # acres
        self.assertEqual(w.select_value(CAT["building_height"], fixture_rows("building_height", "Seven Sisters")), (None, "unit"))
        self.assertEqual(w.select_value(CAT["mountain_elevation"], [qty(4806, unit="Q199")]), (None, "unit"))  # "1": no unit
        self.assertEqual(w.select_value(CAT["mountain_elevation"], [qty(4806), qty(4806, unit="Q199")]), (None, "unit"))

    def test_unit_conversion_to_display_units(self):
        self.assertAlmostEqual(w.to_display(1811, WD + "Q11579", "°C"), 1537.85)  # kelvin
        self.assertAlmostEqual(w.to_display(-37.894, WD + "Q42289", "°C"), -38.83, places=2)  # Fahrenheit
        self.assertAlmostEqual(w.to_display(1, WD + "Q253276", "km"), 1.609344)  # mile
        self.assertAlmostEqual(w.to_display(1, WD + "Q232291", "km²"), 2.589988110336)  # square mile
        self.assertAlmostEqual(w.to_display(1, WD + "Q1811", "million km"), 149.5978707)  # astronomical unit
        self.assertIsNone(w.to_display(1, WD + "Q11573", "km²"))  # length is not an area
        self.assertEqual(w.select_value(CAT["element_melting_point"], fixture_rows("element_melting_point", "mercury")), (-38.8, {}))
        self.assertEqual([w.round_display(v) for v in (1537.85, 38.83, 2.345, 0.494)], [1538, 38.8, 2.35, 0.49])

    def test_populations_need_a_year_and_use_the_latest(self):
        city = CAT["city_population"]
        self.assertEqual(w.select_value(city, fixture_rows("city_population", "Bareilly")), (None, "volatile"))
        self.assertEqual(w.select_value(city, fixture_rows("city_population", "Rome")), (2748109, {"year": 2023}))
        dated = lambda amount, year: {"amount": str(amount), "time": f"{year}-01-01T00:00:00Z", "precision": "9", "rank": NORMAL}
        self.assertEqual(w.select_value(city, [dated(100000, 2010), dated(120000, 2020)]), (120000, {"year": 2020}))
        self.assertEqual(w.select_value(city, [dated(100000, 2020), dated(150000, 2020)]), (None, "conflict"))

    def test_dates_need_year_precision_and_one_year(self):
        self.assertEqual(w.select_value(CAT["first_flight"], fixture_rows("first_flight", "Skylon")), (None, "precision"))
        self.assertEqual(w.select_value(CAT["first_flight"], fixture_rows("first_flight", "Boeing 747")), (1969, {}))
        when = lambda t, p="11": {"time": t, "precision": p, "rank": NORMAL}
        self.assertEqual(w.select_value(CAT["first_flight"], [when("1969-02-09T00:00:00Z"), when("1970-01-01T00:00:00Z", "9")]), (None, "conflict"))
        self.assertEqual(w.year_of("-0500-01-01T00:00:00Z"), -500)
        self.assertEqual(w.year_of("+1903-12-17T00:00:00Z"), 1903)

    def test_labels_bounds_and_volatility_drop_items_before_they_reach_the_pool(self):
        items, skipped = w.build_category(CAT["mountain_elevation"], [
            binding("Q1", "Q4675", amount="4000", unit=WD + "Q11573", rank=NORMAL),
            binding("Q2", "Москва", amount="4000", unit=WD + "Q11573", rank=NORMAL),
            binding("Q3", "Too High", amount="9500", unit=WD + "Q11573", rank=NORMAL),
            binding("Q4", "Mont Blanc", amount="4806", unit=WD + "Q11573", rank=NORMAL),
        ], "2026-10-03")
        self.assertEqual([it["en"]["prompt"] for it in items], ["How high is Mont Blanc above sea level?"])
        self.assertEqual(skipped, {"label": 2, "bounds": 1})

    def test_one_entity_per_name_and_near_identical_prompts(self):
        city = CAT["city_population"]
        rows = [binding("Q10", "Hyderabad", 300, amount="6809970", time="2011-01-01T00:00:00Z", precision="9", rank=NORMAL),
                binding("Q11", "Hyderabad", 90, amount="1732693", time="2017-01-01T00:00:00Z", precision="9", rank=NORMAL)]
        items, skipped = w.build_category(city, rows, "2026-10-03")
        self.assertEqual([(it["answer"], it["source"]) for it in items], [(6809970, "https://www.wikidata.org/wiki/Q10#P1082")])
        self.assertEqual(skipped, {"same_name": 1})
        twins = [{"en": {"prompt": "How long is the Nile river?"}}, {"en": {"prompt": "How long is the  nile River ?"}},
                 {"en": {"prompt": "How long is the Amazon River?"}}]
        self.assertEqual(w.dedupe(twins), ([twins[0], twins[2]], 1))

    def test_prompt_articles(self):
        self.assertEqual(w.country_name("United States"), "the United States")
        self.assertEqual(w.country_name("Philippines"), "the Philippines")
        self.assertEqual(w.country_name("Solomon Islands"), "the Solomon Islands")
        self.assertEqual(w.country_name("France"), "France")
        self.assertEqual(CAT["lake_area"]["prompt"]("Caspian Sea", {}), "What is the surface area of the Caspian Sea?")
        self.assertEqual(CAT["solar_system_size"]["prompt"]("Titan", {"parentLabel": "Saturn"}), "What is the diameter of Titan, a moon of Saturn?")
        self.assertEqual(CAT["solar_system_size"]["prompt"]("Moon", {"parentLabel": "Earth"}), "What is the diameter of the Moon?")
        self.assertEqual(CAT["university_founded"]["prompt"]("University of Oxford", {}), "In what year was the University of Oxford founded?")


class Pool(unittest.TestCase):
    def test_fixture_builds_the_expected_items_with_category_ranges(self):
        pool, report = w.build_pool(RAW, generated_at="2026-10-03")
        items = pool["items"]
        self.assertEqual(len(items), 21)
        self.assertEqual(report["country_area"], {"kept": 4, "candidates": 5, "skipped": {"conflict": 1, "duplicate": 0}, "capped": 0})
        self.assertEqual(report["solar_system_distance"], {"kept": 0, "error": "no response"})
        for it in items:
            self.assertRegex(it["id"], r"^w\d{4}$")
            self.assertEqual(set(it), {"id", "type", "category", "domain", "en", "answer", "accept", "source", "difficulty_hint", "volatile", "generated_at"})
            ranges = {(c.get("category", c["name"]), c["unit"]): c["accept"] for c in w.CATEGORIES}
            self.assertEqual(it["accept"], ranges[(it["category"], it["en"]["unit"])])  # never derived from the answer
            self.assertTrue(it["accept"][0] <= it["answer"] <= it["accept"][1])
            self.assertRegex(it["source"], r"^https://www\.wikidata\.org/wiki/Q\d+#P\d+$")
            self.assertEqual((it["type"], it["difficulty_hint"], it["volatile"]), ("interval", "unknown", False))
        by_prompt = {it["en"]["prompt"]: it for it in items}
        self.assertEqual(by_prompt["What was the population of Rome in 2023?"]["answer"], 2748109)
        self.assertEqual(by_prompt["On average, how far is Titan from Saturn?"]["answer"], 1221870)

    def test_cap_keeps_the_best_known_entities(self):
        rows = [binding(f"Q{n}", f"Peak {chr(65 + n)}", 100 - n, amount=str(1000 + n), unit=WD + "Q11573", rank=NORMAL) for n in range(5)]
        capped = dict(CAT["mountain_elevation"], cap=2)
        pool, report = w.build_pool({"mountain_elevation": {"results": {"bindings": rows}}}, generated_at="x")
        self.assertEqual(len(pool["items"]), 5)
        w.CATEGORIES[1] = capped
        try:
            pool, report = w.build_pool({"mountain_elevation": {"results": {"bindings": rows}}}, generated_at="x")
        finally:
            w.CATEGORIES[1] = CAT["mountain_elevation"]
        self.assertEqual([it["answer"] for it in pool["items"]], [1000, 1001])
        self.assertEqual(report["mountain_elevation"]["capped"], 3)

    def test_ids_are_stable_across_runs_and_scheduled_items_survive(self):
        first, _ = w.build_pool(RAW, generated_at="2026-10-03")
        smaller = {k: v for k, v in RAW.items() if k != "country_area"}
        second, report = w.build_pool(smaller, first["items"], scheduled_ids={"w0002"}, generated_at="2026-11-01")
        old = {it["source"]: it["id"] for it in first["items"]}
        for it in second["items"]:
            self.assertEqual(it["id"], old[it["source"]])
        ids = [it["id"] for it in second["items"]]
        self.assertIn("w0002", ids)  # scheduled: carried over although the new run no longer returned it
        self.assertNotIn("w0001", ids)
        self.assertEqual(report["_total"]["carried_scheduled"], 1)
        new = w.assign_ids([{"source": "https://www.wikidata.org/wiki/Q9#P1", "en": {}}], first["items"])
        self.assertEqual(new[0]["id"], "w0022")


class Cli(unittest.TestCase):
    def test_fixture_run_writes_pool_and_review(self):
        with tempfile.TemporaryDirectory() as tmp:
            out = os.path.join(tmp, "pool.json")
            with redirect_stderr(io.StringIO()):
                code = w.main(["--fixture", FIXTURE, "--out", out, "--schedule", os.path.join(tmp, "none.json")])
            self.assertEqual(code, 0)
            with open(out) as f:
                self.assertEqual(len(json.load(f)["items"]), 21)
            with open(os.path.join(tmp, "pool.REVIEW.md")) as f:
                review = f.read()
            self.assertIn("| country_area | 4 | 5 | conflict: 1 |", review)
            self.assertIn("**Total: 21 items**", review)
            self.assertEqual(review.count("\n- [ ] `w"), 21)  # 30 samples, or every item when fewer
            self.assertIn("1969** ·", review)  # years print without a thousands separator

    def test_unreachable_endpoint_leaves_the_pool_alone(self):
        def offline(query, retries=3):
            raise urllib.error.URLError("no route to host")
        real = w.sparql
        w.sparql = offline
        try:
            with tempfile.TemporaryDirectory() as tmp:
                out = os.path.join(tmp, "pool.json")
                err = io.StringIO()
                with redirect_stderr(err):
                    code = w.main(["--out", out])
                self.assertEqual(code, 2)
                self.assertFalse(os.path.exists(out))
                self.assertIn("Wikidata SPARQL is unreachable", err.getvalue())
        finally:
            w.sparql = real


if __name__ == "__main__":
    unittest.main()
