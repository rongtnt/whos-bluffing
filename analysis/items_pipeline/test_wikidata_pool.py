"""Offline tests for wikidata_pool.py: the filters, unit conversion, stable ids, and a full run on the saved SPARQL
fixture (fixtures/sparql_fixture.json, real responses trimmed from the 2026-10-03 run). Never touches the network.

    python3 -m unittest discover -s analysis/items_pipeline        (also run by `npm test` in web/)
"""
import io
import json
import re
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
        # The query service writes BCE years in astronomical numbering: '-0283' is 284 BCE (Wikidata's own JSON: -0284).
        self.assertEqual(w.year_of("-0283-01-01T00:00:00Z"), -284)
        self.assertEqual(w.year_of("0000-01-01T00:00:00Z"), -1)  # year 0 = 1 BCE
        self.assertEqual(w.year_of("+0001-01-01T00:00:00Z"), 1)
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

    def test_entity_names_read_as_they_would_in_a_comparison(self):
        name = lambda cat, label, row=None: CAT[cat]["entity"](label, row or {})
        self.assertEqual(name("river_length", "Nile"), "the Nile")
        self.assertEqual(name("river_length", "River Thames"), "the River Thames")
        self.assertEqual(name("country_area", "United States"), "the United States")
        self.assertEqual(name("bridge_length", "Golden Gate Bridge"), "the Golden Gate Bridge")
        self.assertEqual(name("bridge_length", "Øresund"), "the Øresund bridge")
        self.assertEqual(name("lake_area", "Caspian Sea"), "the Caspian Sea")
        self.assertEqual(name("university_founded", "Harvard University"), "Harvard University")
        self.assertEqual(name("moon_distance", "Moon", {"parentLabel": "Earth"}), "the Moon")
        self.assertNotIn("entity", CAT["mountain_elevation"])  # the label as it is: "Mont Blanc"


class NewKinds(unittest.TestCase):
    def dated(self, prop, t, precision="11", rank=NORMAL, **kw):
        return {"prop": prop, "time": t, "precision": precision, "rank": rank, **kw}

    def test_launch_year_comes_from_launch_properties_only_never_inception(self):
        rows = [self.dated("P577", "1989-04-21T00:00:00Z"), self.dated("P577", "1990-09-28T00:00:00Z"), self.dated("P571", "1987-01-01T00:00:00Z", "9")]
        answer, extra = w.select_release(rows)
        self.assertEqual((answer, extra["source_prop"]), (1989, "P577"))  # the first release anywhere
        self.assertEqual(w.select_release([self.dated("P729", "1938-01-01T00:00:00Z", "9")])[0], 1938)  # service entry (car models)
        self.assertEqual(w.select_release([self.dated("P5204", "1987-04-01T00:00:00Z")])[0], 1987)  # date of commercialization
        self.assertEqual(w.select_release([self.dated("P580", "1982-08-01T00:00:00Z")])[0], 1982)  # start time (production)
        self.assertEqual(w.select_release([self.dated("P571", "2006-04-23T00:00:00Z")]), (None, "no_launch_date"))  # Spotify's founding
        self.assertEqual(w.select_release([self.dated("P577", "1990-01-01T00:00:00Z", "8")]), (None, "precision"))  # decade only
        self.assertNotIn("P571", w.LAUNCH_PROPS)
        self.assertNotIn("P571", CAT["product_released"]["query"])
        normal_and_preferred = [self.dated("P577", "2009-05-17T00:00:00Z"), self.dated("P577", "2011-11-18T00:00:00Z", rank=PREFERRED)]
        self.assertEqual(w.select_release(normal_and_preferred)[0], 2011)  # a preferred date hides the others

    def test_speakers_count_first_language_statements_only_latest_year(self):
        part = {"part": w.FIRST_LANGUAGE}
        rows = [{"amount": "379007140", "time": "2019-01-01T00:00:00Z", "precision": "9", "rank": NORMAL, **part},
                {"amount": "753359540", "time": "2019-01-01T00:00:00Z", "precision": "9", "rank": PREFERRED, "part": WD + "Q125421"},
                {"amount": "339370920", "time": "2011-01-01T00:00:00Z", "precision": "9", "rank": NORMAL, **part},
                {"amount": "1132366680", "time": "2019-01-01T00:00:00Z", "precision": "9", "rank": NORMAL}]
        answer, extra = w.select_speakers(rows)
        self.assertEqual((answer, extra["year"]), (379007140, 2019))  # not the preferred second-language count
        self.assertEqual(w.select_speakers(rows[3:]), (None, "no_first_language"))
        clash = [{"amount": a, "time": "2019-01-01T00:00:00Z", "precision": "9", "rank": PREFERRED, **part} for a in ("221000000", "254300000")]
        self.assertEqual(w.select_speakers(clash), (None, "conflict"))

    def test_curated_product_names_and_the_source_property(self):
        items, _ = w.build_category(CAT["product_released"], [
            binding("Q621427", "Q621427", 54, prop="P577", time="2007-06-29T00:00:00Z", precision="11", rank=NORMAL, referenced="true", imported="false"),
        ], "2026-10-04")
        it = items[0]
        self.assertEqual((it["name"], it["answer"], it["source"]), ("the iPhone", 2007, "https://www.wikidata.org/wiki/Q621427#P577"))
        self.assertEqual(it["en"]["prompt"], "In what year did the iPhone first come out?")
        self.assertIn("Q186437", w.PRODUCTS)  # the Game Boy
        for name in ("country_population", "company_founded", "product_released", "language_speakers", "landmark_height", "landmark_built"):
            self.assertIn(name, CAT)

    def test_regeneration_keeps_pageviews_until_the_next_pageviews_run(self):
        first, _ = w.build_pool(RAW, generated_at="2026-10-03")
        previous = [dict(it, enwiki="X", views_month=123) for it in first["items"]]
        second, _ = w.build_pool(RAW, previous, generated_at="2026-10-04")
        self.assertTrue(all((it["enwiki"], it["views_month"]) == ("X", 123) for it in second["items"]))


class Curated(unittest.TestCase):
    ENTRY = {"qid": "Q866", "name": "YouTube", "year": 2005, "event": "launched on 23 April 2005", "source": "https://en.wikipedia.org/wiki/YouTube"}

    def test_curated_launch_years_are_merged_fact_checked_win_over_twins_and_keep_their_id(self):
        twin = binding("Q866", "Q866", 300, prop="P577", time="2005-12-15T00:00:00Z", precision="11", rank=NORMAL, referenced="true", imported="false")
        raw = dict(RAW, product_released={"results": {"bindings": [twin]}})
        first, report = w.build_pool(raw, curated=[self.ENTRY], generated_at="2026-10-04")
        yt = [it for it in first["items"] if it["category"] == "product_released"]
        self.assertEqual(len(yt), 1)  # the generated twin of the same entity is dropped
        it = yt[0]
        self.assertEqual((it["answer"], it["source"], it["replaces"], it["fact_checked"], it["name"]),
                         (2005, self.ENTRY["source"], "https://www.wikidata.org/wiki/Q866#P571", True, "YouTube"))
        self.assertEqual(it["en"], {"prompt": "In what year did YouTube first come out?", "unit": "year"})
        self.assertIn("launched on 23 April 2005", it["notes"])
        self.assertEqual(report["_total"]["curated"], 1)
        second, _ = w.build_pool(raw, first["items"], curated=[self.ENTRY], generated_at="2026-10-05")
        again = [i for i in second["items"] if i["category"] == "product_released"]
        self.assertEqual([(i["id"], i["answer"]) for i in again], [(it["id"], 2005)])  # same id, not pinned a second time

    def test_the_curated_file_is_clean(self):
        with open(os.path.join(HERE, "..", "..", "items", "launch_years.json")) as f:
            entries = json.load(f)["items"]
        self.assertEqual(len({e["qid"] for e in entries}), len(entries))
        for e in entries:
            self.assertRegex(e["source"], r"^https://")
            self.assertTrue(1800 <= e["year"] <= w.CURRENT_YEAR and e["name"] and e["event"], e)
            self.assertEqual(e["name"], w.PRODUCTS.get(e["qid"]), e)  # a famous product of the list, named the same way


class AiPack(unittest.TestCase):
    ENTRIES = [{"category": "ai_released", "name": "ChatGPT", "answer": 2022, "note": "released on November 30, 2022",
                "source": "https://en.wikipedia.org/wiki/ChatGPT", "qid": "Q115564437"},
               {"category": "ai_params", "name": "Grok-1", "answer": 314e9, "note": "314 billion parameters",
                "source": "https://x.ai/news/grok-os"},
               {"category": "ai_released", "name": "Deep Blue's win over Kasparov", "answer": 1997, "note": "May 1997 rematch",
                "source": "https://en.wikipedia.org/wiki/Deep_Blue_versus_Garry_Kasparov", "qid": "Q3235334",
                "prompt": "In what year did Deep Blue beat Garry Kasparov in a match?"},
               {"category": "ai_timeline", "name": "ChatGPT (released)", "month": "2022-11", "note": "30 November 2022",
                "source": "https://en.wikipedia.org/wiki/ChatGPT", "qid": "Q115564437", "fun": "A reveal line."},
               {"category": "ai_money", "tier": 2, "name": "OpenAI's valuation (Oct 2024 round)", "answer": 157e9, "as_of": "2024-10",
                "volatile": True, "note": "$157 billion", "source": "https://en.wikipedia.org/wiki/OpenAI#:~:text=%24157%20billion"},
               {"category": "ai_tech", "tier": 3, "name": "Claude 2", "unit": "tokens of context", "answer": 100000,
                "note": "100K", "source": "https://www.anthropic.com/news/claude-2"}]

    def test_ai_items_are_merged_fact_checked_famous_and_keep_their_ids(self):
        first, report = w.build_pool(RAW, ai=self.ENTRIES, generated_at="2026-10-04")
        ai = {it["name"]: it for it in first["items"] if it["category"].startswith("ai_")}
        self.assertEqual(set(ai), {"ChatGPT", "Grok-1", "Deep Blue's win over Kasparov", "ChatGPT (released)",
                                   "OpenAI's valuation (Oct 2024 round)", "Claude 2"})
        chat = ai["ChatGPT"]
        self.assertEqual((chat["answer"], chat["fact_checked"], chat["famous"], chat["replaces"], chat["domain"]),
                         (2022, True, True, "https://www.wikidata.org/wiki/Q115564437#P577", "everyday"))
        self.assertEqual(chat["en"], {"prompt": "In what year did ChatGPT first come out?", "unit": "year"})
        self.assertEqual(chat["notes"], "curated: released on November 30, 2022")
        self.assertEqual(ai["Grok-1"]["en"], {"prompt": "How many parameters does Grok-1 have?", "unit": "parameters"})
        self.assertNotIn("replaces", ai["Grok-1"])  # no Wikidata entity named: its own id is its entity
        self.assertEqual(ai["Deep Blue's win over Kasparov"]["en"]["prompt"], "In what year did Deep Blue beat Garry Kasparov in a match?")
        self.assertEqual(report["_total"]["ai"], 6)
        val, ctx = ai["OpenAI's valuation (Oct 2024 round)"], ai["Claude 2"]
        self.assertEqual((val["en"]["unit"], val["volatile"], val["as_of"], val["tier"], val["famous"]), ("USD", True, "2024-10", 2, True))
        self.assertEqual((ctx["en"], ctx["tier"], ctx["accept"]), ({"prompt": "How long is Claude 2's context window, in tokens?",
                                                                    "unit": "tokens of context"}, 3, [100, 1e9]))
        self.assertNotIn("famous", ctx)  # technical facts are judged by their own pageviews
        quiet, _ = w.build_pool(RAW, ai=[{"category": "ai_drama", "name": "Microsoft delays its Recall feature (Jun 2024)", "month": "2024-06",
                                          "famous": False, "note": "14 June 2024", "source": "https://en.wikipedia.org/wiki/Windows_Recall", "fun": "x"}],
                                generated_at="2026-10-05")
        drama = next(it for it in quiet["items"] if it["category"] == "ai_drama")
        self.assertEqual((drama["tier"], drama["answer"], "famous" in drama), (2, 202406, False))
        self.assertEqual((chat["tier"], ai["Grok-1"]["tier"]), (1, 3))
        month = ai["ChatGPT (released)"]  # same source as the year item, another category: its own id
        self.assertEqual((month["answer"], month["month"], month["en"]["unit"], month["fun"], month["domain"]),
                         (202211, "2022-11", "month", "A reveal line.", "history"))
        self.assertNotEqual(month["id"], chat["id"])
        self.assertNotIn("fun", chat)
        self.assertEqual(w.format_answer(month), "Nov 2022")
        second, _ = w.build_pool(RAW, first["items"], ai=self.ENTRIES, next_number=first["next_number"], generated_at="2026-10-05")
        again = {it["name"]: it["id"] for it in second["items"] if it["category"].startswith("ai_")}
        self.assertEqual(again, {n: it["id"] for n, it in ai.items()})  # same ids; their notes do not pin a second copy
        third, _ = w.build_pool(RAW, second["items"], ai=self.ENTRIES[1:], next_number=second["next_number"], generated_at="2026-10-06")
        self.assertNotIn("ChatGPT", [it["name"] for it in third["items"] if it["category"] == "ai_released"])  # taken out of the file: gone

    def test_the_ai_file_is_clean(self):
        with open(os.path.join(HERE, "..", "..", "items", "ai_curated.json")) as f:
            entries = json.load(f)["items"]
        self.assertEqual(len({(e["category"], e["source"]) for e in entries}), len(entries))  # ids are kept by category and source
        self.assertEqual(len({(e["category"], e.get("unit"), e["name"]) for e in entries}), len(entries))
        by_cat = {}
        for e in entries:
            cat = w.AI_CATEGORIES[e["category"]]
            self.assertRegex(e["source"], r"^https://[^ ]+$")
            self.assertTrue(e["name"] and e["note"], e)
            answer = int(e["month"].replace("-", "")) if "month" in e else e["answer"]
            self.assertIn(e["tier"], (1, 2, 3), e)
            if e["category"] == "ai_tech":
                cat = dict(cat, accept=w.TECH_UNITS[e["unit"]][0])
            if e["category"] == "ai_money":
                self.assertTrue(e["volatile"] and re.match(r"^20\d\d-(0[1-9]|1[0-2])$", e["as_of"]), e)
                self.assertRegex(e["name"], r"\((?:[^()]*\b)?(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec) 20\d\d|20\d\d\)|\b(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec) 20\d\d")
            if "month" in e:
                self.assertRegex(e["month"], r"^(19|20)\d\d-(0[1-9]|1[0-2])$")
            self.assertTrue(cat["accept"][0] <= answer <= cat["accept"][1], e)
            self.assertLessEqual(len(e.get("fun", "")), 140)
            if "qid" in e:
                self.assertRegex(e["qid"], r"^Q\d+$")
            by_cat.setdefault(e["category"], []).append(e)
        self.assertEqual(set(by_cat), set(w.AI_CATEGORIES))
        self.assertTrue(all(len(v) >= 15 for v in by_cat.values()), {k: len(v) for k, v in by_cat.items()})
        for e in by_cat["ai_drama"]:
            self.assertTrue(e["fun"] and len(e["fun"]) <= 140 and re.search(r"(19|20)\d\d", e["note"]), e["name"])
            # The date is the answer to "Which came first?", so it must not sit in the name (it showed in the options).
            self.assertNotRegex(e["name"], r"\((Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec) 20\d\d\)$")
            self.assertIn("famous", e)  # decided per event from its subject's pageviews
        timeline = {e["name"]: e["month"] for e in by_cat["ai_timeline"]}
        for name, month in (("OpenAI (founded)", "2015-12"), ("Anthropic (founded)", "2021-01"), ("ChatGPT (released)", "2022-11"),
                            ("the Transformer paper (posted)", "2017-06"), ("DeepMind (bought by Google)", "2014-01"),
                            ("Stable Diffusion (released)", "2022-08"), ("Midjourney (open beta)", "2022-07"), ("DALL·E 2 (announced)", "2022-04")):
            self.assertEqual(timeline.get(name), month, name)


POLITICS_FIXTURE = os.path.join(HERE, "..", "..", "web", "test", "fixtures", "politics_curated.json")
POLITICS_FILE = os.path.join(HERE, "..", "..", "items", "politics_curated.json")
DATED = re.compile(r"\b(?:19|20)\d{2}\b|\b(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\.? \d|\b\d{1,2} (?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)")


class PoliticsPack(unittest.TestCase):
    """The Politics pack (items/politics_curated.json) on its test fixture (web/test/fixtures/politics_curated.json, the
    same schema): what the pipeline needs from every entry, and the fixture through the pool and the pairs."""

    def assert_clean(self, entries):
        self.assertEqual(len({(e["category"], e["source"]) for e in entries}), len(entries))  # ids are kept by category and source
        self.assertEqual(len({(e["category"], e.get("unit"), e["name"]) for e in entries}), len(entries))
        for e in entries:
            cat = w.POL_CATEGORIES[e["category"]]  # a Politics category, nothing else
            self.assertRegex(e["source"], r"^https://[^ ]+$")
            self.assertTrue(e["name"] and e["note"], e)
            self.assertIn(e["tier"], (1, 2, 3), e)
            answer = int(e["month"].replace("-", "")) if "month" in e else e["answer"]
            self.assertTrue(cat["accept"][0] <= answer <= cat["accept"][1], e)
            if "month" in e:
                self.assertRegex(e["month"], r"^\d{4}-(0[1-9]|1[0-2])$")
                self.assertNotRegex(e["name"], DATED)  # "Which came first?": a date in the name shows the answer
            if e["category"] == "pol_elected":
                self.assertNotRegex(e["name"], DATED)
            if e["category"] == "pol_numbers":
                self.assertTrue(e["unit"] and isinstance(e["answer"], int), e)
            if e["category"] == "pol_money":
                self.assertTrue(e["volatile"] and re.match(r"^\d{4}-(0[1-9]|1[0-2])$", e["as_of"]) and DATED.search(e["name"]), e)
            if e["category"] == "pol_drama":
                self.assertTrue(e.get("fun") and "famous" in e, e["name"])
            self.assertLessEqual(len(e.get("fun", "")), 140)
            if "qid" in e:
                self.assertRegex(e["qid"], r"^Q\d+$")

    def test_the_fixture_is_clean_and_has_every_category(self):
        with open(POLITICS_FIXTURE) as f:
            entries = json.load(f)["items"]
        self.assert_clean(entries)
        self.assertEqual(len(entries), 30)
        self.assertEqual({e["category"] for e in entries}, set(w.POL_CATEGORIES))

    def test_the_real_file_is_clean_when_it_exists(self):
        if not os.path.exists(POLITICS_FILE):
            self.skipTest("items/politics_curated.json is not there yet")
        with open(POLITICS_FILE) as f:
            self.assert_clean(json.load(f)["items"])

    def test_the_fixture_flows_through_the_pool_and_the_pairs_and_old_numbers_stay(self):
        import pairs as P
        with open(POLITICS_FIXTURE) as f:
            entries = json.load(f)["items"]
        ai = AiPack.ENTRIES
        before, _ = w.build_pool(RAW, ai=ai, generated_at="2026-10-05")
        after, report = w.build_pool(RAW, before["items"], ai=ai, politics=entries, next_number=before["next_number"], generated_at="2026-10-06")
        old = {it["id"]: it["name"] for it in before["items"]}
        self.assertEqual({i: n for i, n in ((it["id"], it["name"]) for it in after["items"]) if i in old}, old)  # nothing renumbered
        pol = {it["name"]: it for it in after["items"] if it["category"].startswith("pol_")}
        self.assertEqual((len(pol), report["_total"]["politics"]), (30, 30))
        self.assertTrue(all(int(it["id"][1:]) >= before["next_number"] for it in pol.values()))  # new ids only
        votes, ev = pol["Joe Biden's popular vote in 2020"], pol["electoral votes in the Electoral College"]
        self.assertEqual((votes["en"], votes["tier"], votes["accept"], "famous" in votes),
                         ({"prompt": "Joe Biden's popular vote in 2020: how many votes?", "unit": "votes"}, 3, [1, 1e10], False))
        self.assertEqual(ev["en"]["unit"], "electoral votes")
        obama = pol["Barack Obama (first elected president)"]
        self.assertEqual((obama["answer"], obama["en"], obama["tier"], obama["famous"], obama["replaces"]),
                         (2008, {"prompt": "Barack Obama (first elected president): in what year?", "unit": "year"}, 1, True,
                          "https://www.wikidata.org/wiki/Q45578#P39"))
        nixon = pol["Richard Nixon resigns the presidency"]
        self.assertEqual((nixon["answer"], nixon["month"], nixon["en"]["unit"], nixon["fun"], nixon["famous"]),
                         (197408, "1974-08", "month", "He is the only US president to have resigned.", True))
        self.assertNotIn("famous", pol["The Supreme Court decides Bush v. Gore"])  # its subject's article is under 50,000 views
        money = pol["TARP's authorized spending (Oct 2008)"]
        self.assertEqual((money["en"]["unit"], money["volatile"], money["as_of"], money["tier"]), ("USD", True, "2008-10", 2))
        again, _ = w.build_pool(RAW, after["items"], ai=ai, politics=entries, next_number=after["next_number"], generated_at="2026-10-07")
        self.assertEqual({it["name"]: it["id"] for it in again["items"] if it["category"].startswith("pol_")}, {n: it["id"] for n, it in pol.items()})
        # The pairs: every (category, unit) of the fixture pairs, the units never mix, nothing is ranked.
        doc = P.build_pairs(after["items"], generated_at="2026-10-06")[0]
        mine = [p for p in doc["pairs"] if p["category"].startswith("pol_")]
        self.assertEqual({(p["category"], p["unit"]) for p in mine}, {(it["category"], it["en"]["unit"]) for it in pol.values()})
        templates = {(t["category"], t["unit"]): t for t in doc["templates"]}
        self.assertEqual((templates[("pol_numbers", "votes")]["prompt"], templates[("pol_numbers", "electoral votes")]["min_gap"]), ("Which is bigger?", 1.3))
        self.assertFalse(any(P.ranked_ok(p) for p in mine))
        by = {frozenset((p["a"], p["b"])): p for p in mine}
        tarp = by[frozenset(("TARP's authorized spending (Oct 2008)", "the President's annual salary (since 2001)"))]
        self.assertEqual((tarp["tier"], tarp["volatile"], [tarp["a"], tarp["b"]][tarp["truth"]]), (2, True, "TARP's authorized spending (Oct 2008)"))
        self.assertNotIn(frozenset(("Joe Biden's popular vote in 2020", "Donald Trump's popular vote in 2020")), by)  # one entity, and 1.1 apart
        drama = by[frozenset(("Richard Nixon resigns the presidency", "The House impeaches Bill Clinton"))]
        self.assertEqual(([drama["a"], drama["b"]][drama["truth"]], drama["prompt"], drama["tier"]), ("Richard Nixon resigns the presidency", "Which came first?", 2))
        # Adding the pack leaves every earlier pair number and a/b order alone.
        first = P.build_pairs(before["items"], generated_at="2026-10-05")[0]
        second = P.build_pairs(after["items"], first["pairs"], numbers=first, generated_at="2026-10-06")[0]
        key = lambda p: (p["a_id"], p["b_id"], p["category"], p["unit"])
        self.assertEqual({p["id"]: key(p) for p in second["pairs"] if p["id"] in {q["id"] for q in first["pairs"]}}, {p["id"]: key(p) for p in first["pairs"]})
        self.assertTrue(all(int(p["id"][1:]) >= first["next_number"] for p in second["pairs"] if p["category"].startswith("pol_")))


class References(unittest.TestCase):
    def row(self, referenced, imported, rank=NORMAL):
        return {"referenced": referenced, "imported": imported, "rank": rank}

    def test_best_reference_among_best_ranked_statements(self):
        self.assertEqual(w.ref_quality([self.row("true", "false")]), "referenced")
        self.assertEqual(w.ref_quality([self.row("false", "true"), self.row("true", "true")]), "referenced")
        self.assertEqual(w.ref_quality([self.row("false", "true")]), "imported")  # only "imported from Wikimedia project"
        self.assertEqual(w.ref_quality([self.row("false", "false")]), "none")
        self.assertEqual(w.ref_quality([{"rank": NORMAL}]), "none")  # saved fixture: no reference columns
        # A deprecated statement's reference does not count; a preferred statement hides normal ones.
        self.assertEqual(w.ref_quality([self.row("false", "false"), self.row("true", "false", DEPRECATED)]), "none")
        self.assertEqual(w.ref_quality([self.row("false", "true", PREFERRED), self.row("true", "false")]), "imported")

    def test_items_carry_name_and_reference_quality(self):
        items, _ = w.build_category(CAT["river_length"], [
            binding("Q3392", "Nile", 300, amount="6650", unit=WD + "Q828224", rank=NORMAL, referenced="true", imported="false"),
            binding("Q1653", "Danube", 200, amount="2850", unit=WD + "Q828224", rank=NORMAL, referenced="false", imported="true"),
        ], "2026-10-03")
        self.assertEqual([(it["name"], it["ref_quality"], it["fact_checked"]) for it in items],
                         [("the Nile", "referenced", False), ("the Danube", "imported", False)])


class Pool(unittest.TestCase):
    def test_fixture_builds_the_expected_items_with_category_ranges(self):
        pool, report = w.build_pool(RAW, generated_at="2026-10-03")
        items = pool["items"]
        self.assertEqual(len(items), 21)
        self.assertEqual(report["country_area"], {"kept": 4, "candidates": 5, "skipped": {"conflict": 1, "duplicate": 0}, "capped": 0})
        self.assertEqual(report["solar_system_distance"], {"kept": 0, "error": "no response"})
        for it in items:
            self.assertRegex(it["id"], r"^w\d{4}$")
            self.assertEqual(set(it), {"id", "type", "category", "domain", "en", "answer", "accept", "source", "difficulty_hint", "volatile",
                                       "generated_at", "name", "ref_quality", "fact_checked", "sitelinks"})
            self.assertEqual((it["ref_quality"], it["fact_checked"]), ("none", False))  # the fixture has no reference columns
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
        rows[4] = binding("Q4", "Peak E", 96, amount="1004", unit=WD + "Q11573", rank=NORMAL, referenced="true", imported="false")
        w.CATEGORIES[1] = capped
        try:
            pool, report = w.build_pool({"mountain_elevation": {"results": {"bindings": rows}}}, generated_at="x")
        finally:
            w.CATEGORIES[1] = CAT["mountain_elevation"]
        self.assertEqual([it["answer"] for it in pool["items"]], [1000, 1001, 1004])  # referenced: kept beyond the cap
        self.assertEqual(report["mountain_elevation"]["capped"], 2)

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

    def test_ids_of_dropped_items_are_never_handed_out_again(self):
        first, _ = w.build_pool(RAW, generated_at="2026-10-03")
        top = max(first["items"], key=lambda it: it["id"])
        self.assertEqual(first["next_number"], int(top["id"][1:]) + 1)
        without = {k: v for k, v in RAW.items() if k != top["category"]}
        second, _ = w.build_pool(without, first["items"], next_number=first["next_number"], generated_at="2026-10-04")
        third, _ = w.build_pool(without, second["items"], next_number=second["next_number"], generated_at="2026-10-05")
        self.assertNotIn(top["id"], [it["id"] for it in third["items"]])
        self.assertEqual(third["next_number"], first["next_number"])  # the dropped item's id stays taken
        new = w.assign_ids([{"source": "https://www.wikidata.org/wiki/Q9#P1", "en": {}}], third["items"], third["next_number"])
        self.assertEqual(new[0]["id"], f"w{first['next_number']:04d}")

    def test_hand_corrected_items_are_pinned_and_their_generated_twins_dropped(self):
        first, _ = w.build_pool(RAW, generated_at="2026-10-03")
        by_source = {it["source"]: it for it in first["items"]}
        nile = by_source["https://www.wikidata.org/wiki/Q3392#P2043"]
        finland = next(it for it in first["items"] if it["en"]["prompt"] == "What is the area of Finland?")
        corrected = [dict(nile, answer=6650, notes="references disagree; value follows Britannica"),  # still a Wikidata source
                     dict(finland, answer=338000, source="https://stat.fi/area", replaces=finland["source"], notes="fact-checked")]
        previous = [it for it in first["items"] if it["id"] not in {nile["id"], finland["id"]}] + corrected
        second, report = w.build_pool(RAW, previous, generated_at="2026-11-01")
        items = {it["id"]: it for it in second["items"]}
        self.assertEqual(len(second["items"]), len(first["items"]))  # no duplicate twins, no lost items
        self.assertEqual(report["_total"]["pinned"], 2)
        self.assertEqual((items[finland["id"]]["answer"], items[finland["id"]]["source"]), (338000, "https://stat.fi/area"))
        self.assertTrue(items[finland["id"]]["fact_checked"] and items[nile["id"]]["fact_checked"])
        self.assertEqual(items[nile["id"]]["generated_at"], "2026-10-03")  # kept verbatim, not regenerated
        self.assertFalse(any(it["source"] == finland["source"] for it in second["items"]))  # the generated twin is gone
        self.assertEqual(sum(it["fact_checked"] for it in second["items"]), 2)
        # The twin is matched by category and entity, so a regenerated statement of another property is dropped too;
        # an item checked but left ambiguous (ranked_ok: false) is pinned without fact_checked; retired_at is kept.
        other_prop = {"category": "country_area", "en": {"unit": "km²"}, "source": finland["source"].replace("#P2046", "#P2047")}
        self.assertEqual(w.twin_key(other_prop), w.twin_key(corrected[1]))
        depth = {"category": "lake", "en": {"unit": "m"}, "source": f"{WD.replace('http://', 'https://')}Q35342#P4511".replace("/entity/", "/wiki/")}
        area = dict(depth, en={"unit": "km²"}, source=depth["source"].replace("#P4511", "#P2046"))
        self.assertNotEqual(w.twin_key(depth), w.twin_key(area))  # one lake, two questions: not twins
        ambiguous = dict(nile, notes="definition unclear", ranked_ok=False, retired_at="2026-10-04")
        third, _ = w.build_pool(RAW, [it for it in previous if it["id"] != nile["id"]] + [ambiguous], generated_at="2026-11-02")
        kept = {it["id"]: it for it in third["items"]}[nile["id"]]
        self.assertEqual((kept["fact_checked"], kept["ranked_ok"], kept["retired_at"]), (False, False, "2026-10-04"))


class Cli(unittest.TestCase):
    def test_fixture_run_writes_pool_and_review(self):
        with tempfile.TemporaryDirectory() as tmp:
            out = os.path.join(tmp, "pool.json")
            with redirect_stderr(io.StringIO()):
                code = w.main(["--fixture", FIXTURE, "--out", out, "--schedule", os.path.join(tmp, "none.json"),
                               "--rounds", os.path.join(tmp, "none.json"), "--pairs", os.path.join(tmp, "none.json"),
                               "--curated", os.path.join(tmp, "none.json"), "--ai", os.path.join(tmp, "none.json"),
                               "--politics", os.path.join(tmp, "none.json")])
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
