#!/usr/bin/env python3
"""Build the daily-game item pool (items/pool.json + items/pool.REVIEW.md) from Wikidata.

Python 3.9+, standard library only.

    python3 analysis/items_pipeline/wikidata_pool.py                      # live: query Wikidata, write the pool
    python3 analysis/items_pipeline/wikidata_pool.py --raw-dir DIR        # also cache each raw SPARQL response in DIR
                                                                          # (an existing file is reused, not re-fetched)
    python3 analysis/items_pipeline/wikidata_pool.py --fixture FILE --out OUT.json   # offline, from saved responses

Every item is a 90%-range question with a fixed per-category sanity range (`accept`, never derived from the answer)
and a source link to the Wikidata statement. Filters: deprecated statements are ignored and preferred ones win;
an item is skipped when its best values conflict, a value lacks a unit, a population has no year, a date is less
precise than a year, the answer falls outside the category's sanity range, or the English label is missing or not
in Latin script. Near-identical prompts are dropped and each category is capped (best-known entities first, by
Wikipedia sitelinks; referenced items beyond the cap are kept as well). Ids are stable: a statement that was already
in the pool keeps its id.

Each item also gets `sitelinks` (Wikipedia editions with an article: how well known it is), `name` (the entity as it
reads in a comparison: "the Nile", "Mont Blanc"), `ref_quality` (over the
best-ranked statements: `referenced` = a reference with something other than "imported from Wikimedia project"
P143 / Wikimedia import URL P4656 / retrieved P813; `imported` = only Wikipedia-imported references; `none`) and
`fact_checked` (false for generated items). Items with `notes` in the previous pool were corrected by hand: they are
pinned (kept verbatim with `fact_checked: true`), and the generated twin of the same Wikidata statement (their
`replaces` URL, or their own source when it is a Wikidata link) is dropped.
"""
import argparse
import datetime
import json
import os
import random
import re
import sys
import time
import urllib.parse
import urllib.request

ENDPOINT = "https://query.wikidata.org/sparql"
USER_AGENT = "HowSureItemPipeline/1.0 (https://github.com/rongtnt/howsure)"
ROOT = os.path.normpath(os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", ".."))
WD = "http://www.wikidata.org/entity/"
LABEL = 'SERVICE wikibase:label { bd:serviceParam wikibase:language "en". }'
CONFLICT_TOLERANCE = 0.02  # best values more than 2% apart = conflicting
CURRENT_YEAR = datetime.date.today().year

# Wikidata unit -> (dimension, factor to the base unit: metre, square metre; temperatures are converted separately)
UNITS = {
    "Q11573": ("length", 1.0), "Q828224": ("length", 1000.0), "Q174728": ("length", 0.01),
    "Q174789": ("length", 0.001), "Q3710": ("length", 0.3048), "Q253276": ("length", 1609.344),
    "Q1811": ("length", 149597870700.0),
    "Q25343": ("area", 1.0), "Q712226": ("area", 1e6), "Q35852": ("area", 1e4), "Q232291": ("area", 2589988.110336),
    "Q25267": ("temperature", "C"), "Q11579": ("temperature", "K"), "Q42289": ("temperature", "F"),
}
# Display unit -> (dimension, factor from the base unit)
DISPLAY = {
    "m": ("length", 1.0), "km": ("length", 1e-3), "million km": ("length", 1e-9),
    "km²": ("area", 1e-6), "°C": ("temperature", None),
}

PLANETS = "wd:Q308 wd:Q313 wd:Q2 wd:Q111 wd:Q319 wd:Q193 wd:Q324 wd:Q332"
# Well-known moons by English name (Wikipedia sitelinks cannot tell them from tiny moons: bots inflate those).
MOON_NAMES = ["Moon", "Phobos", "Deimos", "Io", "Europa", "Ganymede", "Callisto", "Amalthea", "Mimas", "Enceladus",
              "Tethys", "Dione", "Rhea", "Titan", "Hyperion", "Iapetus", "Phoebe", "Miranda", "Ariel", "Umbriel",
              "Titania", "Oberon", "Triton", "Nereid", "Proteus", "Charon"]
MOONS = (f"VALUES ?parent {{ {PLANETS} wd:Q339 }} VALUES ?name {{ {' '.join(f'{chr(34)}{n}{chr(34)}@en' for n in MOON_NAMES)} }} "
         "?item rdfs:label ?name ; wdt:P397 ?parent .")
DWARF_PLANETS = "wd:Q339 wd:Q596 wd:Q1471 wd:Q1765 wd:Q1770"
# Famous products and launches ("Which came out first?"): enwiki article titles resolved to Wikidata ids through the
# Wikipedia API (pageprops, redirects followed) on 2026-10-04, with the name as it reads in a question. Labels alone
# picked films, re-releases and renamed items ("Twitter" is now "X"), so the list is by id.
PRODUCTS = {
    "Q621427": "the iPhone", "Q59802": "the iPad", "Q9479": "the iPod", "Q1137478": "the Macintosh",
    "Q201652": "the Apple II", "Q18010946": "the Apple Watch", "Q26936286": "AirPods", "Q622493": "the Walkman",
    "Q186437": "the Game Boy", "Q188642": "the Game Boy Advance", "Q172742": "the Nintendo Entertainment System",
    "Q183259": "the Super Nintendo", "Q184839": "the Nintendo 64", "Q182172": "the GameCube", "Q8079": "the Wii",
    "Q19610114": "the Nintendo Switch", "Q170323": "the Nintendo DS", "Q10677": "the PlayStation",
    "Q10680": "the PlayStation 2", "Q10683": "the PlayStation 3", "Q5014725": "the PlayStation 4",
    "Q63184502": "the PlayStation 5", "Q170325": "the PlayStation Portable", "Q132020": "the Xbox",
    "Q48263": "the Xbox 360", "Q13361286": "the Xbox One", "Q10676": "the Sega Genesis", "Q206261": "the Atari 2600",
    "Q99775": "the Commodore 64", "Q23882": "the ZX Spectrum", "Q202712": "the IBM PC", "Q219691": "the Nokia 3310",
    "Q136469": "the Kindle", "Q207786": "the Tamagotchi", "Q47043": "the Rubik's Cube", "Q932209": "the Furby",
    "Q167447": "Barbie", "Q170484": "Lego", "Q17243": "Monopoly", "Q170436": "Scrabble", "Q131689": "the Frisbee",
    "Q1118802": "the Slinky", "Q181331": "the Post-it note", "Q34467": "the CD", "Q5294": "the DVD",
    "Q47770": "Blu-ray", "Q5293": "the floppy disk", "Q1647694": "the USB flash drive", "Q182323": "the Ford Model T",
    "Q152946": "the Volkswagen Beetle", "Q467767": "the Fiat 500", "Q243543": "the Toyota Corolla",
    "Q183476": "the Ford Mustang", "Q56166": "the Chevrolet Corvette", "Q219357": "the Porsche 911",
    "Q213115": "the Toyota Prius", "Q1463050": "the Tesla Model S", "Q7705507": "the Tesla Model 3",
    "Q326015": "the Citroën 2CV", "Q247": "the Volkswagen Golf", "Q216747": "the Honda Civic",
    "Q908027": "the Land Rover Defender", "Q1406": "Windows", "Q83370": "Windows 95", "Q11248": "Windows XP",
    "Q388": "Linux", "Q94": "Android", "Q48493": "iOS", "Q9366": "Google Search", "Q9334": "Gmail", "Q866": "YouTube",
    "Q355": "Facebook", "Q918": "Twitter", "Q209330": "Instagram", "Q1049511": "WhatsApp", "Q48938223": "TikTok",
    "Q333618": "Snapchat", "Q52": "Wikipedia", "Q907311": "Netflix", "Q689141": "Spotify", "Q12013": "Google Maps",
    "Q40984": "Skype", "Q71910": "Tetris", "Q173626": "Pac-Man", "Q11168": "Super Mario Bros.",
    "Q12395": "The Legend of Zelda", "Q49740": "Minecraft", "Q349375": "Fortnite", "Q131007": "World of Warcraft",
    "Q184816": "The Sims", "Q220665": "Space Invaders", "Q216293": "Pong", "Q17452": "Grand Theft Auto V",
    "Q1133204": "Street Fighter II", "Q637137": "Pokémon Red and Blue", "Q189784": "Doom",
    "Q37123": "Sonic the Hedgehog", "Q4558721": "Angry Birds", "Q8768018": "Candy Crush Saga", "Q96417649": "Among Us",
    "Q20966579": "Pokémon Go", "Q2813": "Coca-Cola", "Q47719": "Pepsi", "Q506796": "the Big Mac", "Q212193": "Nutella",
    "Q367251": "Kit Kat", "Q51482": "Red Bull", "Q138585": "Oreo", "Q528187": "Pringles", "Q206978": "Sprite",
    "Q9935": "Fanta", "Q739550": "M&M's", "Q714179": "Snickers", "Q215707": "Toblerone",
}
PRODUCT_ITEMS = f"VALUES ?item {{ {' '.join('wd:' + q for q in PRODUCTS)} }}"
# language, modern language, natural language, human language, standard language, macrolanguage, register (Hindi)
LANGUAGE_CLASSES = ["Q34770", "Q1288568", "Q33742", "Q20162172", "Q399495", "Q152559", "Q286576"]
FIRST_LANGUAGE = WD + "Q36870"  # P518 "applies to part": first language
COMPANIES = ("VALUES ?cls { wd:Q891723 wd:Q4830453 wd:Q6881511 wd:Q783794 wd:Q167037 } ?item wdt:P31 ?cls . "
             "FILTER NOT EXISTS { VALUES ?club { wd:Q476028 wd:Q847017 } ?item wdt:P31 ?club }")  # not football or sports clubs
# Landmarks: statue, colossal statue, tower, observation tower, bell tower, clock tower, cathedral, basilica, church
# building, mausoleum, amphitheatre, opera house, pyramid, castle, palace, temple, monument, lighthouse, obelisk (+ stadium
# for the year built). The well-known ones are picked in a subquery that runs first (UNION of constant classes, sitelinks
# filter): with VALUES ?cls the public endpoint times out.
LANDMARK_CLASSES = ["Q179700", "Q1779653", "Q12518", "Q1440300", "Q200334", "Q2869004", "Q2977", "Q163687", "Q16970", "Q162875",
                    "Q54831", "Q153562", "Q12516", "Q23413", "Q16560", "Q44539", "Q4989906", "Q39715", "Q170980"]


def well_known(classes, min_sitelinks):
    """Items of any of the classes with at least min_sitelinks Wikipedia articles, picked first (see LANDMARK_CLASSES)."""
    union = " UNION ".join(f"{{ ?item wdt:P31 wd:{c} . }}" for c in classes)
    return (f"{{ SELECT DISTINCT ?item WHERE {{ {union} ?item wikibase:sitelinks ?sl . FILTER(?sl >= {min_sitelinks}) "
            f"FILTER NOT EXISTS {{ ?item wdt:P576 [] }} }} }} hint:Prior hint:runFirst true .")


def landmarks(min_sitelinks, extra_classes=()):
    return well_known(LANDMARK_CLASSES + list(extra_classes), min_sitelinks)


# Reference quality of the statement ?st: a real reference (anything but P143 imported from / P4656 Wikimedia import
# URL / P813 retrieved), or only a Wikipedia import. pr: predicates only (prv: value nodes are a different namespace).
REFS = """BIND(EXISTS { ?st prov:wasDerivedFrom ?ref . ?ref ?rp ?rv .
    FILTER(STRSTARTS(STR(?rp), "http://www.wikidata.org/prop/reference/P") && ?rp NOT IN (pr:P143, pr:P4656, pr:P813)) } AS ?referenced)
  BIND(EXISTS { ?st prov:wasDerivedFrom/(pr:P143|pr:P4656) ?imp . } AS ?imported)"""


def quantity_query(where, prop, min_sitelinks, extra=""):
    return f"""SELECT DISTINCT ?item ?itemLabel ?sitelinks ?amount ?unit ?rank ?referenced ?imported {extra} WHERE {{
  {where}
  ?item wikibase:sitelinks ?sitelinks . FILTER(?sitelinks >= {min_sitelinks})
  ?item p:{prop} ?st . ?st wikibase:rank ?rank ; psv:{prop} ?v .
  ?v wikibase:quantityAmount ?amount ; wikibase:quantityUnit ?unit .
  {REFS}
  {LABEL}
}}"""


def population_query(where, min_sitelinks, prop="P1082", extra=""):
    """Year-stamped counts (population, speakers): every statement with its point in time (P585)."""
    return f"""SELECT DISTINCT ?item ?itemLabel ?sitelinks ?amount ?time ?precision ?rank ?referenced ?imported {extra} WHERE {{
  {where}
  ?item wikibase:sitelinks ?sitelinks . FILTER(?sitelinks >= {min_sitelinks})
  ?item p:{prop} ?st . ?st wikibase:rank ?rank ; ps:{prop} ?amount .
  OPTIONAL {{ ?st pqv:P585 ?tv . ?tv wikibase:timeValue ?time ; wikibase:timePrecision ?precision . }}
  {"OPTIONAL { ?st pq:P518 ?part . }" if "?part" in extra else ""}
  {REFS}
  {LABEL}
}}"""


def release_query(where, min_sitelinks):
    """Launch years: publication date (P577), service entry (P729, car models) and inception (P571), tagged by ?prop."""
    return f"""SELECT DISTINCT ?item ?itemLabel ?sitelinks ?prop ?time ?precision ?rank ?referenced ?imported WHERE {{
  {where}
  ?item wikibase:sitelinks ?sitelinks . FILTER(?sitelinks >= {min_sitelinks})
  VALUES (?p ?psv ?prop) {{ (p:P577 psv:P577 "P577") (p:P729 psv:P729 "P729") (p:P571 psv:P571 "P571") }}
  ?item ?p ?st . ?st wikibase:rank ?rank ; ?psv ?tv .
  ?tv wikibase:timeValue ?time ; wikibase:timePrecision ?precision .
  {REFS}
  {LABEL}
}}"""


def year_query(where, statement, min_sitelinks):
    return f"""SELECT DISTINCT ?item ?itemLabel ?sitelinks ?time ?precision ?rank ?referenced ?imported WHERE {{
  {where}
  ?item wikibase:sitelinks ?sitelinks . FILTER(?sitelinks >= {min_sitelinks})
  {statement}
  ?tv wikibase:timeValue ?time ; wikibase:timePrecision ?precision .
  {REFS}
  {LABEL}
}}"""


def article(label, nouns):
    """'the ' before labels ending in a generic noun (the Golden Gate Bridge, the Caspian Sea)."""
    return "the " if label.split()[-1] in nouns else ""


BUILDING_NOUNS = {"Building", "Tower", "Towers", "Centre", "Center", "Plaza", "Hotel", "Palace", "Spire", "Needle", "Tower 1"}
LANDMARK_NOUNS = {"Statue", "Tower", "Cathedral", "Church", "Monument", "Lighthouse", "Column", "Obelisk", "Basilica", "Minster",
                  "Abbey", "Memorial", "Needle", "Pagoda", "Mosque", "Stadium", "Arena", "Bowl", "Dome", "Wheel", "Gate", "Clock"}
COUNTRY_THE = {"Netherlands", "Philippines", "Bahamas", "Gambia", "Maldives", "Comoros", "Seychelles", "Vatican City"}


def country_name(label):
    plural_or_formal = label.split()[0] in {"United", "Republic", "Democratic", "Kingdom", "Federated", "Central", "Dominican", "Czech"}
    ends = label.split()[-1] in {"Islands", "Republic", "Emirates"}
    return ("the " if plural_or_formal or ends or label in COUNTRY_THE else "") + label


def moon_name(label):
    return "the Moon" if label == "Moon" else label


def the(label):
    return label if label.startswith("the ") else f"the {label}"


def bridge_name(label):
    return the(label) if label.split()[-1] in {"Bridge", "Viaduct", "Causeway"} else f"the {label} bridge"


def university_name(label):
    return f"the {label}" if " of " in label else label


# name (one query), category (daily rotation group, default: name; at most one per day), domain, kind, display unit,
# accept (sanity range for every item of the query), cap, query, prompt(label, row) -> text,
# entity(label, row) -> the entity as it reads in a comparison ("the Nile"; default: the label)
CATEGORIES = [
    dict(name="country_area", domain="geography", kind="quantity", prop="P2046", unit="km²", accept=[0.1, 20000000], cap=230,
         query=quantity_query("?item wdt:P297 [] . FILTER NOT EXISTS { ?item wdt:P576 [] }", "P2046", 20),
         prompt=lambda label, row: f"What is the area of {country_name(label)}?", entity=lambda label, row: country_name(label)),
    dict(name="mountain_elevation", domain="geography", kind="quantity", prop="P2044", unit="m", accept=[0, 9000], cap=200,
         query=quantity_query("VALUES ?cls { wd:Q8502 wd:Q8072 wd:Q169358 } ?item wdt:P31 ?cls .", "P2044", 25),
         prompt=lambda label, row: f"How high is {label} above sea level?"),
    dict(name="river_length", domain="geography", kind="quantity", prop="P2043", unit="km", accept=[1, 8000], cap=200,
         query=quantity_query("?item wdt:P31 wd:Q4022 .", "P2043", 25),
         prompt=lambda label, row: f"How long is the {label}?" if "river" in label.lower() else f"How long is the {label} river?",
         entity=lambda label, row: the(label)),
    dict(name="lake_area", category="lake", domain="geography", kind="quantity", prop="P2046", unit="km²", accept=[0.1, 400000], cap=150,
         query=quantity_query("VALUES ?cls { wd:Q23397 wd:Q188025 } ?item wdt:P31 ?cls .", "P2046", 40),
         prompt=lambda label, row: f"What is the surface area of {article(label, {'Sea'})}{label}?",
         entity=lambda label, row: f"{article(label, {'Sea'})}{label}"),
    dict(name="lake_depth", category="lake", domain="geography", kind="quantity", prop="P4511", unit="m", accept=[1, 2000], cap=100,
         query=quantity_query("VALUES ?cls { wd:Q23397 wd:Q188025 } ?item wdt:P31 ?cls .", "P4511", 30),
         prompt=lambda label, row: f"How deep is {article(label, {'Sea'})}{label} at its deepest point?",
         entity=lambda label, row: f"{article(label, {'Sea'})}{label}"),
    dict(name="building_height", domain="everyday", kind="quantity", prop="P2048", unit="m", accept=[1, 1000], cap=200,
         query=quantity_query("VALUES ?cls { wd:Q11303 wd:Q1440476 wd:Q11166728 wd:Q18142 } ?item wdt:P31 ?cls . "
                              "FILTER NOT EXISTS { ?item wdt:P5817 wd:Q12377751 } FILTER NOT EXISTS { ?item wdt:P576 [] }", "P2048", 20),
         prompt=lambda label, row: f"How tall is {article(label, BUILDING_NOUNS)}{label}?",
         entity=lambda label, row: f"{article(label, BUILDING_NOUNS)}{label}"),
    dict(name="bridge_length", domain="everyday", kind="quantity", prop="P2043", unit="m", accept=[1, 200000], cap=200,
         query=quantity_query("VALUES ?cls { wd:Q12280 wd:Q12570 wd:Q158218 wd:Q158438 wd:Q2129021 wd:Q1735209 } ?item wdt:P31 ?cls . "
                              "FILTER NOT EXISTS { ?item wdt:P576 [] }", "P2043", 15),
         prompt=lambda label, row: f"How long is {bridge_name(label)}?", entity=lambda label, row: bridge_name(label)),
    dict(name="solar_system_size", domain="physics", kind="quantity", prop="P2386", unit="km", accept=[1, 200000], cap=60,
         query=quantity_query(f"{{ VALUES ?item {{ {PLANETS} {DWARF_PLANETS} }} }} UNION "
                              f"{{ {MOONS} }}", "P2386", 15, "?parentLabel"),
         prompt=lambda label, row: (f"What is the diameter of {moon_name(label)}?" if label == "Moon" or not row.get("parentLabel")
                                    else f"What is the diameter of {label}, a moon of {row['parentLabel']}?"),
         entity=lambda label, row: moon_name(label)),
    dict(name="solar_system_distance", domain="physics", kind="quantity", prop="P2233", unit="million km", accept=[1, 10000], cap=13,
         query=quantity_query(f"VALUES ?item {{ {PLANETS} {DWARF_PLANETS} }}", "P2233", 15),
         prompt=lambda label, row: f"On average, how far is {label} from the Sun?"),
    dict(name="moon_distance", category="solar_system_distance", domain="physics", kind="quantity", prop="P2233", unit="km", accept=[1000, 30000000], cap=40,
         query=quantity_query(MOONS, "P2233", 15, "?parentLabel"),
         prompt=lambda label, row: f"On average, how far is {moon_name(label)} from {row['parentLabel']}?",
         entity=lambda label, row: moon_name(label)),
    dict(name="element_melting_point", domain="physics", kind="quantity", prop="P2101", unit="°C", accept=[-273, 4000], cap=110,
         query=quantity_query("?item wdt:P31 wd:Q11344 ; wdt:P1086 ?z . FILTER(?z <= 100)", "P2101", 30),
         prompt=lambda label, row: f"At what temperature does {label} melt?"),
    dict(name="city_population", domain="geography", kind="population", prop="P1082", unit="people", accept=[10000, 50000000], cap=250,
         query=f"""SELECT DISTINCT ?item ?itemLabel ?sitelinks ?amount ?time ?precision ?rank ?referenced ?imported WHERE {{
  VALUES ?cls {{ wd:Q1637706 wd:Q1549591 wd:Q5119 }} ?item wdt:P31 ?cls ; wdt:P1082 ?best . FILTER(?best >= 1000000)
  ?item wikibase:sitelinks ?sitelinks . FILTER(?sitelinks >= 60)
  FILTER NOT EXISTS {{ ?item wdt:P576 [] }}
  ?item p:P1082 ?st . ?st wikibase:rank ?rank ; ps:P1082 ?amount .
  OPTIONAL {{ ?st pqv:P585 ?tv . ?tv wikibase:timeValue ?time ; wikibase:timePrecision ?precision . }}
  {REFS}
  {LABEL}
}}""",
         prompt=lambda label, row: f"What was the population of {label} in {row['year']}?"),
    dict(name="first_flight", domain="history", kind="year", prop="P606", unit="year", accept=[1890, CURRENT_YEAR], cap=200,
         query=year_query("?item wdt:P606 [] .", "?item p:P606 ?st . ?st wikibase:rank ?rank ; psv:P606 ?tv .", 20),
         prompt=lambda label, row: f"In what year did the {label} first fly?", entity=lambda label, row: the(label)),
    dict(name="university_founded", domain="history", kind="year", prop="P571", unit="year", accept=[800, CURRENT_YEAR], cap=200,
         query=year_query("VALUES ?cls { wd:Q3918 wd:Q902104 wd:Q875538 } ?item wdt:P31 ?cls .",
                          "?item p:P571 ?st . ?st wikibase:rank ?rank ; psv:P571 ?tv .", 50),
         prompt=lambda label, row: f"In what year was {university_name(label)} founded?", entity=lambda label, row: university_name(label)),
    dict(name="first_ascent", domain="history", kind="year", prop="P793", unit="year", accept=[1500, CURRENT_YEAR], cap=150,
         query=year_query("?item p:P793/ps:P793 wd:Q1194369 ; wdt:P2044 [] .",
                          "?item p:P793 ?st . ?st ps:P793 wd:Q1194369 ; wikibase:rank ?rank ; pqv:P585 ?tv .", 15),
         prompt=lambda label, row: f"In what year was {label} first climbed?"),
    # Relatable categories (2026-10-04): what everyone has heard of.
    dict(name="country_population", domain="geography", kind="population", prop="P1082", unit="people", accept=[100, 2000000000], cap=230,
         query=population_query("?item wdt:P297 [] . FILTER NOT EXISTS { ?item wdt:P576 [] }", 20),
         prompt=lambda label, row: f"What was the population of {country_name(label)} in {row['year']}?",
         entity=lambda label, row: country_name(label)),
    dict(name="company_founded", domain="history", kind="year", prop="P571", unit="year", accept=[1500, CURRENT_YEAR], cap=200,
         query=year_query(COMPANIES, "?item p:P571 ?st . ?st wikibase:rank ?rank ; psv:P571 ?tv .", 60),
         prompt=lambda label, row: f"In what year was {label} founded?"),
    dict(name="product_released", domain="everyday", kind="release", prop="P577", unit="year", accept=[1800, CURRENT_YEAR], cap=150,
         query=release_query(PRODUCT_ITEMS, 1), labels=PRODUCTS,
         prompt=lambda label, row: f"In what year did {label} first come out?"),
    dict(name="language_speakers", domain="everyday", kind="speakers", prop="P1098", unit="people", accept=[10000, 2000000000], cap=150,
         query=population_query(well_known(LANGUAGE_CLASSES, 40), 40, prop="P1098", extra="?part"),
         prompt=lambda label, row: f"How many people spoke {label} as a first language in {row['year']}?"),
    dict(name="landmark_height", domain="everyday", kind="quantity", prop="P2048", unit="m", accept=[1, 700], cap=200,
         query=quantity_query(landmarks(30), "P2048", 30),
         prompt=lambda label, row: f"How tall is {article(label, LANDMARK_NOUNS)}{label}?",
         entity=lambda label, row: f"{article(label, LANDMARK_NOUNS)}{label}"),
    dict(name="landmark_built", domain="history", kind="year", prop="P571", unit="year", accept=[-3000, CURRENT_YEAR], cap=200,
         query=year_query(landmarks(40, ["Q483110"]), "?item p:P571 ?st . ?st wikibase:rank ?rank ; psv:P571 ?tv .", 40),
         prompt=lambda label, row: f"In what year was {article(label, LANDMARK_NOUNS)}{label} built?",
         entity=lambda label, row: f"{article(label, LANDMARK_NOUNS)}{label}"),
]

LATIN_LABEL = re.compile("^[0-9A-Za-z\u00c0-\u024f\u1e00-\u1eff .,'\u2019()&/+\u2013-]+$")  # Latin letters and accents, en dash


def qid(uri):
    return uri.rsplit("/", 1)[-1]


def flat(binding):
    return {k: v["value"] for k, v in binding.items()}


def to_display(amount, unit_uri, display):
    """Converts a Wikidata quantity to the display unit; None when the unit is missing or unsupported."""
    unit = UNITS.get(qid(unit_uri))
    target = DISPLAY[display]
    if unit is None or unit[0] != target[0]:
        return None
    if unit[0] == "temperature":
        return {"C": amount, "K": amount - 273.15, "F": (amount - 32) * 5 / 9}[unit[1]]
    return amount * unit[1] * target[1]


def round_display(value):
    if abs(value) >= 100:
        return int(round(value))
    return round(value, 1 if abs(value) >= 10 else 2)


def best_rank(rows):
    """Drops deprecated statements; preferred statements win over normal ones."""
    live = [r for r in rows if not r["rank"].endswith("DeprecatedRank")]
    preferred = [r for r in live if r["rank"].endswith("PreferredRank")]
    return preferred or live


def conflicting(values):
    lo, hi = min(values), max(values)
    return hi - lo > CONFLICT_TOLERANCE * max(abs(lo), abs(hi))


def year_of(time_value):
    """'+1969-02-09T00:00:00Z' or '1969-02-09T00:00:00Z' -> 1969; BCE years are negative."""
    sign = -1 if time_value.startswith("-") else 1
    return sign * int(time_value.lstrip("+-").split("-", 1)[0])


REF_ORDER = ("none", "imported", "referenced")


def ref_quality(rows):
    """Best reference quality among an entity's best-ranked statement rows ('none' when the columns are absent)."""
    best = "none"
    for r in best_rank(rows):
        q = "referenced" if r.get("referenced") == "true" else "imported" if r.get("imported") == "true" else "none"
        best = max(best, q, key=REF_ORDER.index)
    return best


def select_release(rows):
    """Launch year: the earliest best-ranked publication date (first release anywhere), else the earliest service entry,
    else a single inception year."""
    for prop in ("P577", "P729", "P571"):
        stated = best_rank([r for r in rows if r.get("prop") == prop])
        dated = [r for r in stated if int(r["precision"]) >= 9]
        if not stated:
            continue
        if not dated:
            return None, "precision"
        years = sorted(set(year_of(r["time"]) for r in dated))
        if prop == "P571" and len(years) > 1:
            return None, "conflict"
        return years[0], {"source_prop": prop, "_used": dated}
    return None, "deprecated"


def select_speakers(rows):
    """First-language speakers only (P518 = first language; preferred statements in the same set disagree on total vs
    second-language counts): the latest year with a point in time, preferred values of that year if any."""
    first = [r for r in rows if r.get("part") == FIRST_LANGUAGE and not r["rank"].endswith("DeprecatedRank")
             and r.get("time") and int(r.get("precision", 0)) >= 9]
    if not first:
        return None, "no_first_language"
    year = max(year_of(r["time"]) for r in first)
    latest = [r for r in first if year_of(r["time"]) == year]
    latest = [r for r in latest if r["rank"].endswith("PreferredRank")] or latest
    values = sorted(set(int(round(float(r["amount"]))) for r in latest))
    if conflicting(values):
        return None, "conflict"
    return values[len(values) // 2], {"year": year, "_used": latest}


def select_value(category, rows):
    """Returns (answer, extra) for one entity's statement rows, or (None, reason) when the entity is skipped."""
    if category["kind"] == "release":
        return select_release(rows)
    if category["kind"] == "speakers":
        return select_speakers(rows)
    rows = best_rank(rows)
    if not rows:
        return None, "deprecated"
    kind = category["kind"]
    if kind == "quantity":
        values = [to_display(float(r["amount"]), r.get("unit", ""), category["unit"]) for r in rows]
        if any(v is None for v in values):
            return None, "unit"
        values = sorted(set(round_display(v) for v in values))
        if conflicting(values):
            return None, "conflict"
        return values[len(values) // 2], {}
    if kind == "year":
        if any(int(r["precision"]) < 9 for r in rows):
            return None, "precision"
        years = sorted(set(year_of(r["time"]) for r in rows))
        return (years[0], {}) if len(years) == 1 else (None, "conflict")
    # population: only year-stamped values; the latest year among the best-ranked statements
    dated = [r for r in rows if r.get("time") and int(r.get("precision", 0)) >= 9]
    if not dated:
        return None, "volatile"
    year = max(year_of(r["time"]) for r in dated)
    values = sorted(set(int(round(float(r["amount"]))) for r in dated if year_of(r["time"]) == year))
    if conflicting(values):
        return None, "conflict"
    return values[len(values) // 2], {"year": year}


def normalize(prompt):
    return re.sub(r"\b(the|a|an)\b", "", re.sub(r"[^a-z0-9 ]+", " ", prompt.lower())).split()


def build_category(category, bindings, generated_at):
    """Raw SPARQL bindings -> (items sorted by popularity, Counter-like dict of skip reasons)."""
    by_item = {}
    for b in bindings:
        row = flat(b)
        by_item.setdefault(qid(row["item"]), []).append(row)
    items, skipped = [], {}

    def skip(reason):
        skipped[reason] = skipped.get(reason, 0) + 1

    for q, rows in by_item.items():
        label = category.get("labels", {}).get(q) or rows[0].get("itemLabel", "")  # curated names win (products)
        if not label or re.fullmatch(r"Q\d+", label) or not LATIN_LABEL.match(label):
            skip("label")
            continue
        answer, extra = select_value(category, rows)
        if answer is None:
            skip(extra)
            continue
        lo, hi = category["accept"]
        if not lo <= answer <= hi:
            skip("bounds")
            continue
        used = extra.pop("_used", None) or rows
        source_prop = extra.pop("source_prop", category["prop"])
        row = dict(rows[0], **extra)
        items.append({
            "type": "interval",
            "category": category.get("category", category["name"]),
            "domain": category["domain"],
            "en": {"prompt": category["prompt"](label, row), "unit": category["unit"]},
            "answer": answer,
            "accept": list(category["accept"]),
            "source": f"https://www.wikidata.org/wiki/{q}#{source_prop}",
            "difficulty_hint": "unknown",
            "volatile": False,
            "generated_at": generated_at,
            "name": category.get("entity", lambda label, row: label)(label, row),
            "ref_quality": ref_quality(used),
            "fact_checked": False,
            "sitelinks": int(rows[0].get("sitelinks", 0)),
            "_label": " ".join(normalize(label)),
        })
    items.sort(key=lambda it: (-it["sitelinks"], it["source"]))
    names, unique = set(), []
    for it in items:
        if it["_label"] in names:
            skip("same_name")
            continue
        names.add(it["_label"])
        unique.append(it)
    return unique, skipped


def dedupe(items):
    """Keeps the best-known item among near-identical prompts (same words, ignoring case, punctuation, articles)."""
    seen, out, dropped = set(), [], 0
    for it in items:
        key = tuple(normalize(it["en"]["prompt"]))
        if key in seen:
            dropped += 1
            continue
        seen.add(key)
        out.append(it)
    return out, dropped


CARRIED = ("enwiki", "views_month")  # written by pageviews.py; kept until its next run


def assign_ids(items, previous):
    """Reuses the id of a statement already in the pool (keyed by source); new statements get the next free ids.
    Pageview fields of a statement already in the pool are carried over."""
    old_items = {it["source"]: it for it in previous}
    used = {it["id"] for it in previous}
    next_n = max([int(i[1:]) for i in used] + [0]) + 1
    out = []
    for it in items:
        prev = old_items.get(it["source"])
        if prev:
            item_id = prev["id"]
        else:
            item_id = f"w{next_n:04d}"
            next_n += 1
        new = dict({"id": item_id}, **{k: v for k, v in it.items() if not k.startswith("_")})
        new.update({k: prev[k] for k in CARRIED if prev and k in prev})
        out.append(new)
    return out


WIKIDATA_SOURCE = re.compile(r"^https://www\.wikidata\.org/wiki/Q\d+#P\d+$")


def twin_key(item):
    """The Wikidata statement a hand-corrected item stands for: its `replaces` URL, else its own Wikidata source."""
    return item.get("replaces") or (item["source"] if WIKIDATA_SOURCE.match(item["source"]) else None)


def pin(previous_items, generated):
    """Hand-corrected items (with `notes`) win over their generated twins: the pinned item keeps its id, prompt, answer
    and source, gains fact_checked, and takes name/ref_quality from the twin when it has none. Returns
    (pinned items, generated items without the twins)."""
    pinned = [dict(it) for it in previous_items if it.get("notes")]
    twins = {twin_key(it): it for it in pinned if twin_key(it)}
    kept = []
    for it in generated:
        p = twins.get(it["source"])
        if p is None:
            kept.append(it)
            continue
        for k in ("name", "ref_quality", "sitelinks"):
            p.setdefault(k, it[k])
    for p in pinned:
        p["fact_checked"] = True
        p.setdefault("ref_quality", "none")
    return pinned, kept


def build_pool(responses, previous_items=(), scheduled_ids=(), generated_at=None):
    """responses: {category name: SPARQL JSON}. Returns (pool dict, report dict)."""
    generated_at = generated_at or datetime.date.today().isoformat()
    previous_items = list(previous_items)
    all_items, report = [], {}
    for category in CATEGORIES:
        data = responses.get(category["name"])
        if data is None:
            report[category["name"]] = {"kept": 0, "error": "no response"}
            continue
        items, skipped = build_category(category, data["results"]["bindings"], generated_at)
        items, dupes = dedupe(items)
        # The cap keeps the best-known entities; referenced items beyond it are kept too (ranked rounds may only use
        # referenced or fact-checked items, and the cap alone leaves too few of them).
        kept = items[:category["cap"]] + [it for it in items[category["cap"]:] if it["ref_quality"] == "referenced"]
        report[category["name"]] = {"kept": len(kept), "candidates": len(items) + dupes + sum(skipped.values()),
                                    "skipped": dict(skipped, duplicate=dupes), "capped": len(items) - len(kept)}
        all_items.extend(kept)
    all_items, cross_dupes = dedupe(all_items)
    pinned, all_items = pin(previous_items, all_items)
    pool_items = assign_ids(all_items, previous_items) + pinned
    # Scheduled items must keep resolving even if a later run no longer returns them.
    present = {it["id"] for it in pool_items}
    carried = [it for it in previous_items if it["id"] in set(scheduled_ids) - present]
    pool_items = sorted(pool_items + carried, key=lambda it: it["id"])
    report["_total"] = {"kept": len(pool_items), "carried_scheduled": len(carried), "cross_category_duplicates": cross_dupes,
                        "pinned": len(pinned)}
    return {"version": 1, "generated_at": generated_at, "items": pool_items}, report


def sparql(query, retries=3):
    url = ENDPOINT + "?" + urllib.parse.urlencode({"query": query, "format": "json"})
    request = urllib.request.Request(url, headers={"User-Agent": USER_AGENT, "Accept": "application/sparql-results+json"})
    for attempt in range(retries + 1):
        try:
            with urllib.request.urlopen(request, timeout=90) as response:
                return json.load(response)
        except urllib.error.HTTPError as e:
            if e.code not in (429, 500, 502, 503, 504) or attempt == retries:
                raise
            time.sleep(int(e.headers.get("Retry-After") or 0) or 10 * (attempt + 1))
        except urllib.error.URLError:
            if attempt == retries:
                raise
            time.sleep(10 * (attempt + 1))
    raise RuntimeError("unreachable")


def fetch_all(raw_dir=None):
    responses = {}
    for category in CATEGORIES:
        path = raw_dir and os.path.join(raw_dir, category["name"] + ".json")
        if path and os.path.exists(path):
            with open(path) as f:
                responses[category["name"]] = json.load(f)
            continue
        print(f"querying {category['name']}...", file=sys.stderr)
        responses[category["name"]] = sparql(category["query"])
        if path:
            with open(path, "w") as f:
                json.dump(responses[category["name"]], f)
        time.sleep(2)  # be polite to the public endpoint
    return responses


def review_markdown(pool, report, seed=20261020):
    lines = [f"# Daily item pool — review ({pool['generated_at']})", "",
             "Generated by `analysis/items_pipeline/wikidata_pool.py` from Wikidata. Spot-check the samples below against",
             "their source links; fix or drop a bad item by editing `items/pool.json` (or swap it out of `daily/schedule.json`).",
             "", "| Category | Kept | Candidates | Skipped (reason: count) |", "|---|---|---|---|"]
    for name, r in report.items():
        if name.startswith("_"):
            continue
        skipped = ", ".join(f"{k}: {v}" for k, v in sorted(r.get("skipped", {}).items()) if v) or r.get("error", "")
        capped = f"; capped {r['capped']}" if r.get("capped") else ""
        lines.append(f"| {name} | {r['kept']} | {r.get('candidates', 0)} | {skipped}{capped} |")
    total = report["_total"]
    lines += ["", f"**Total: {total['kept']} items** ({total['cross_category_duplicates']} cross-category duplicates dropped, "
                  f"{total['carried_scheduled']} scheduled items carried over from the previous pool).", "",
              "## 30 random samples", ""]
    rng = random.Random(seed)
    for it in sorted(rng.sample(pool["items"], min(30, len(pool["items"]))), key=lambda i: i["id"]):
        lines.append(f"- [ ] `{it['id']}` {it['en']['prompt']} → **{format_answer(it)}** · {it['source']}")
    lines += ["", "Not generated: independence years. Wikidata has no consistent property for them (\"inception\" often "
                  "records a different event, e.g. Mexico 1810, Nigeria 1963), so they were left out rather than guessed.", ""]
    return "\n".join(lines)


def format_answer(item):
    unit = item["en"]["unit"]
    return str(item["answer"]) if unit == "year" else f"{item['answer']:,} {unit}"


def read_json(path, default):
    if not os.path.exists(path):
        return default
    with open(path) as f:
        return json.load(f)


def main(argv=None):
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--fixture", help="JSON file {category: SPARQL response} to use instead of the network")
    ap.add_argument("--raw-dir", help="cache raw SPARQL responses here (reused when present)")
    ap.add_argument("--out", default=os.path.join(ROOT, "items", "pool.json"))
    ap.add_argument("--review", help="review file (default: next to --out, pool.REVIEW.md)")
    ap.add_argument("--schedule", default=os.path.join(ROOT, "daily", "schedule.json"))
    ap.add_argument("--rounds", default=os.path.join(ROOT, "daily", "rounds.json"), help="ranked rounds: their pairs' items are kept too")
    ap.add_argument("--pairs", default=os.path.join(ROOT, "items", "pairs.json"))
    args = ap.parse_args(argv)

    if args.fixture:
        responses = read_json(args.fixture, None)
    else:
        if args.raw_dir:
            os.makedirs(args.raw_dir, exist_ok=True)
        try:
            responses = fetch_all(args.raw_dir)
        except (urllib.error.URLError, OSError) as e:
            print(f"error: Wikidata SPARQL is unreachable ({e}). The pool was not changed; "
                  "run again later or use --fixture.", file=sys.stderr)
            return 2
    previous = read_json(args.out, {"items": []})["items"]
    scheduled = {i for ids in read_json(args.schedule, {}).values() for i in ids}
    pair_items = {p["id"]: (p["a_id"], p["b_id"]) for p in read_json(args.pairs, {"pairs": []})["pairs"]}
    for day in read_json(args.rounds, {}).values():
        for pid in list(day["ranked"]) + [day["question"]]:
            scheduled.update(pair_items.get(pid, ()))
    pool, report = build_pool(responses, previous, scheduled)
    with open(args.out, "w") as f:
        json.dump(pool, f, ensure_ascii=False, indent=1)
        f.write("\n")
    review = args.review or os.path.join(os.path.dirname(args.out), "pool.REVIEW.md")
    with open(review, "w") as f:
        f.write(review_markdown(pool, report))
    for name, r in report.items():
        print(f"{name}: {r['kept']}", file=sys.stderr)
    return 0


if __name__ == "__main__":
    sys.exit(main())
