#!/usr/bin/env python3
"""Comparison pairs for HowSure rounds (items/pairs.json) and the daily ranked rounds and chat questions
(daily/rounds.json). Python 3.9+, standard library only. From the repo root:

    python3 analysis/items_pipeline/pairs.py

Pairs: two items of items/pool.json with the same category and unit; the larger value is at least 1.3 times the
smaller (melting points compared in kelvin), or, for years, at least 10 years apart ("Which came first?").
Left out: city populations, volatile items, retired items (daily/runtime.json, an export of items_runtime), the
disputed items in DISPUTED, and countries under 20,000 monthly views (famous countries only). Difficulty from the ratio:
>= 3 easy, 1.6-3 medium, 1.3-1.6 hard; for years from the gap: >= 50 easy, 20-49 medium, 10-19 hard. No item is in more
than 25 pairs. Ids are stable and a pair's a/b order never changes once generated (stored answers refer to it); a new
pair's order is a coin flip seeded by its two ids, so the correct answer is A about half the time. `ref_quality` is the
weaker item's (a fact-checked item counts as referenced). `fame` = the lesser of the two items' English Wikipedia
monthly views (`views_month`, pageviews.py): ranked rounds, the chat question and "easy" rounds need fame >= 50,000,
"normal" rounds >= 20,000; "brutal" rounds take any referenced pair. Selection fills each item's 25 slots in that order:
famous and referenced, famous, known (>= 20,000), referenced, the rest.

daily/rounds.json, one line per UTC day, today to today + 120, append-only (existing days are never changed):
{"ranked": [10 pair ids], "question": pair id}. Ranked: only `referenced` pairs, at most 2 per category, 3 easy +
4 medium + 3 hard, both items with >= 50,000 monthly views. Question: one more such pair (medium when possible) for the
Slack and Discord daily question, never one of that day's ranked pairs; a day's 11 pairs are about 22 different entities
(no "Mercury" twice through its diameter and its distance). No pair on two days within 180 days, no item on two days
within 25 (the brief asked for 30; the eligible supply cannot meet it). Days are filled one after another until one
cannot be: famous, referenced supply sets how far ahead the file reaches.
"""
import argparse
import datetime
import hashlib
import json
import os
import random
import re
import sys

ROOT = os.path.normpath(os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", ".."))
CAP = 25
MIN_RATIO = 1.3
MIN_GAP = 10
DAYS_AHEAD = 120
PAIR_NO_REUSE_DAYS = 180
ITEM_NO_REUSE_DAYS = 25  # see the module docstring: 30 cannot be met with the eligible pool
RANKED_MIX = {"easy": 3, "medium": 4, "hard": 3}
MAX_PER_CATEGORY = 2
RETRIES = 40  # random orders tried for a day the weighted order cannot fill
# (item gap in days, ranked pairs per category). A day is filled at the first rung that works: famous, referenced items
# outside countries are few (about 110), and the strict rung alone fills about 6 days.
RULE_LADDER = [(ITEM_NO_REUSE_DAYS, MAX_PER_CATEGORY), (14, 2), (14, 3), (7, 3), (7, 4), (5, 4)]
EXCLUDED_CATEGORIES = {"city_population"}
FAME_RANKED = 50000  # both items' monthly views, for ranked rounds, the chat question and "easy" rounds
FAME_NORMAL = 20000  # both items, for the default ("normal") quick rounds
MIN_VIEWS = {"country_population": FAME_NORMAL}  # famous countries only
KELVIN = 273.15
# Values the 2026-10-03 fact-check (analysis/factcheck-2026-10-03.md) found disputed and that were only swapped out of
# the daily schedule, never corrected: a pair should not depend on them.
DISPUTED = {
    "w0052": "Serbia's area includes Kosovo; most references give 77,589 km² without it",
    "w1808": "Oxford has no clear foundation date (teaching by 1096, rapid growth from 1167)",
}

# (category, unit) -> prompt, and the phrases the roast line uses for the item that is more / less.
TEMPLATES = {
    ("country_area", "km²"): ("Which is larger by area?", "was larger", "was smaller"),
    ("mountain_elevation", "m"): ("Which is higher?", "was higher", "was lower"),
    ("river_length", "km"): ("Which is longer?", "was longer", "was shorter"),
    ("lake", "km²"): ("Which is larger by area?", "was larger", "was smaller"),
    ("lake", "m"): ("Which is deeper?", "was deeper", "was shallower"),
    ("building_height", "m"): ("Which is taller?", "was taller", "was shorter"),
    ("bridge_length", "m"): ("Which is longer?", "was longer", "was shorter"),
    ("solar_system_size", "km"): ("Which has the bigger diameter?", "was bigger", "was smaller"),
    ("solar_system_distance", "million km"): ("Which is farther from the Sun?", "was farther from the Sun", "was closer to the Sun"),
    ("solar_system_distance", "km"): ("Which orbits farther from its planet?", "orbited farther out", "orbited closer in"),
    ("element_melting_point", "°C"): ("Which melts at a higher temperature?", "melted hotter", "melted cooler"),
    ("first_flight", "year"): ("Which came first?", "came first", "came later"),
    ("university_founded", "year"): ("Which was founded first?", "was founded first", "was founded later"),
    ("first_ascent", "year"): ("Which was first climbed earlier?", "was climbed first", "was climbed later"),
    ("country_population", "people"): ("Which country has more people?", "had more people", "had fewer people"),
    ("company_founded", "year"): ("Which company was founded first?", "was founded first", "was founded later"),
    ("product_released", "year"): ("Which came out first?", "came out first", "came out later"),
    ("language_speakers", "people"): ("Which language has more native speakers?", "had more native speakers", "had fewer native speakers"),
    ("landmark_height", "m"): ("Which is taller?", "was taller", "was shorter"),
    ("landmark_built", "year"): ("Which is older?", "was older", "was newer"),
}
NOT_A_PLANET = {"Pluto"}  # "its planet": moons of a dwarf planet stay out of the orbit-distance pairs
REF_RANK = {"none": 0, "imported": 1, "referenced": 2}


def is_year(unit):
    return unit == "year"


def difficulty(ratio=None, gap=None):
    if gap is not None:
        return "easy" if gap >= 50 else "medium" if gap >= 20 else "hard"
    return "easy" if ratio >= 3 else "medium" if ratio >= 1.6 else "hard"


def item_ref(item):
    return "referenced" if item.get("fact_checked") else item.get("ref_quality", "none")


def views(item):
    return item.get("views_month", 0)


def band(fame):
    """2 = famous (>= 50,000 monthly views), 1 = known (>= 20,000), 0 = obscure."""
    return 2 if fame >= FAME_RANKED else 1 if fame >= FAME_NORMAL else 0


def usable(item, retired):
    """Items that may appear in a pair (see the module docstring)."""
    if item["category"] in EXCLUDED_CATEGORIES or item.get("volatile") or item["id"] in retired or item["id"] in DISPUTED:
        return False
    if views(item) < MIN_VIEWS.get(item["category"], 0):
        return False
    if not item.get("name") or (item["category"], item["en"]["unit"]) not in TEMPLATES:
        return False
    if item["en"]["unit"] == "km" and item["category"] == "solar_system_distance":
        parent = item["en"]["prompt"].rsplit(" from ", 1)[-1].rstrip("?")
        if parent in NOT_A_PLANET:
            return False
    return is_year(item["en"]["unit"]) or comparable(item) > 0


def comparable(item):
    """The value ratios are taken on: kelvin for melting points, else the answer."""
    return item["answer"] + KELVIN if item["category"] == "element_melting_point" else item["answer"]


def pair_key(a_id, b_id):
    return (a_id, b_id) if a_id < b_id else (b_id, a_id)


def measure(a, b):
    """(ratio, gap) of two items of one group; None when they are too close to pair."""
    if is_year(a["en"]["unit"]):
        gap = abs(a["answer"] - b["answer"])
        return (None, gap) if gap >= MIN_GAP else None
    lo, hi = sorted((comparable(a), comparable(b)))
    ratio = hi / lo
    return (round(ratio, 3), None) if ratio >= MIN_RATIO else None


def correct_index(a, b):
    """0 when a is the right answer: the larger value, or the earlier year."""
    if is_year(a["en"]["unit"]):
        return 0 if a["answer"] < b["answer"] else 1
    return 0 if comparable(a) > comparable(b) else 1


def coin(a_id, b_id):
    return int(hashlib.sha256(f"{a_id}|{b_id}".encode()).hexdigest(), 16) % 2


def tier(fame, both_referenced):
    """Selection order: 0 famous and referenced (ranked), 1 famous, 2 known, 3 referenced (brutal), 4 the rest."""
    return 0 if fame >= FAME_RANKED and both_referenced else 1 if fame >= FAME_RANKED else 2 if fame >= FAME_NORMAL else 3 if both_referenced else 4


def candidates(items):
    """Every valid pair within each (category, unit) group: [(key, ratio, gap, difficulty, tier)]."""
    groups = {}
    for it in items:
        groups.setdefault((it["category"], it["en"]["unit"]), []).append(it)
    out = []
    for group in groups.values():
        group.sort(key=lambda it: it["id"])
        for i, a in enumerate(group):
            for b in group[i + 1:]:
                m = measure(a, b)
                if m:
                    both = item_ref(a) == item_ref(b) == "referenced"
                    out.append((pair_key(a["id"], b["id"]), m[0], m[1], difficulty(*m), tier(min(views(a), views(b)), both)))
    return out


def interleave(cands, rng):
    """The candidates with the difficulty classes interleaved (hard, medium, easy, hard, ...), each class shuffled."""
    by_level = {"hard": [], "medium": [], "easy": []}
    for c in cands:
        by_level[c[3]].append(c)
    for xs in by_level.values():
        rng.shuffle(xs)
    order = []
    for k in range(max([len(xs) for xs in by_level.values()] + [0])):
        order.extend(xs[k] for xs in by_level.values() if k < len(xs))
    return order


def select(cands, preferred=frozenset(), cap=CAP, seed=20261003):
    """Greedy, maximal under the per-item cap: previously generated pairs first, then by tier (famous and referenced,
    famous, known, referenced, the rest: a famous item's slots go to famous partners first); the difficulty classes
    interleaved within each tier so each item's 25 slots get a mix."""
    rng = random.Random(seed)
    cands = sorted(cands)
    order = [c for c in cands if c[0] in preferred]
    for t in range(5):
        order += interleave([c for c in cands if c[0] not in preferred and c[4] == t], rng)
    degree, chosen = {}, []
    for c in order:
        a_id, b_id = c[0]
        if degree.get(a_id, 0) < cap and degree.get(b_id, 0) < cap:
            degree[a_id] = degree.get(a_id, 0) + 1
            degree[b_id] = degree.get(b_id, 0) + 1
            chosen.append(c)
    return chosen


def build_pairs(pool_items, previous=(), retired=(), scheduled=(), generated_at=None):
    """Returns (pairs document, report). previous: the last items/pairs.json pairs (stable ids and a/b order);
    scheduled: pair ids used in daily/rounds.json, carried over even when they no longer qualify."""
    generated_at = generated_at or datetime.date.today().isoformat()
    by_id = {it["id"]: it for it in pool_items}
    retired = set(retired)
    items = [it for it in pool_items if usable(it, retired)]
    old = {pair_key(p["a_id"], p["b_id"]): p for p in previous}
    chosen = select(candidates(items), preferred=frozenset(old))
    next_n = max([int(p["id"][1:]) for p in previous] + [0]) + 1
    pairs, seen = [], set()
    for key, ratio, gap, level, _ in chosen:
        prev = old.get(key)
        if prev:
            pair_id, a_id, b_id = prev["id"], prev["a_id"], prev["b_id"]
        else:
            pair_id, next_n = f"p{next_n:05d}", next_n + 1
            a_id, b_id = key if coin(*key) == 0 else key[::-1]
        pairs.append(make_pair(pair_id, by_id[a_id], by_id[b_id], ratio, gap, level))
        seen.add(pair_id)
    carried = [p for p in previous if p["id"] in set(scheduled) - seen and p["a_id"] in by_id and p["b_id"] in by_id]
    pairs = sorted(pairs + carried, key=lambda p: p["id"])
    doc = {"version": 1, "generated_at": generated_at,
           "templates": [{"category": c, "unit": u, "prompt": t[0], "more": t[1], "less": t[2]} for (c, u), t in TEMPLATES.items()],
           "pairs": pairs}
    return doc, report(pairs, items, carried)


def make_pair(pair_id, a, b, ratio, gap, level):
    prompt = TEMPLATES[(a["category"], a["en"]["unit"])][0]
    weaker = min(item_ref(a), item_ref(b), key=REF_RANK.get)
    pair = {"id": pair_id, "a_id": a["id"], "b_id": b["id"], "truth": correct_index(a, b), "ratio": ratio}
    if gap is not None:
        pair["gap"] = gap
    pair.update({"prompt": prompt, "a": a["name"], "b": b["name"], "unit": a["en"]["unit"], "category": a["category"],
                 "difficulty_hint": level, "ref_quality": weaker, "fame": min(views(a), views(b))})
    return pair


BANDS = ("famous", "known", "obscure")  # band 2, 1, 0


def report(pairs, items, carried):
    by = {}
    for p in pairs:
        row = by.setdefault(f"{p['category']} ({p['unit']})", {"pairs": 0, "famous": 0, "known": 0, "obscure": 0, "ranked_ok": 0,
                                                              "referenced": 0, "imported": 0, "none": 0, "easy": 0, "medium": 0, "hard": 0})
        row["pairs"] += 1
        row[BANDS[2 - band(p.get("fame", 0))]] += 1
        row["ranked_ok"] += ranked_ok(p)
        row[p["ref_quality"]] += 1
        row[p["difficulty_hint"]] += 1
    in_pairs = {i for p in pairs for i in (p["a_id"], p["b_id"])}
    item_bands = {name: sum(1 for it in items if BANDS[2 - band(views(it))] == name) for name in BANDS}
    return {"categories": dict(sorted(by.items())), "total": len(pairs), "usable_items": len(items),
            "items_in_pairs": len(in_pairs), "carried_scheduled": len(carried), "usable_items_by_band": item_bands,
            "pairs_by_band": {name: sum(r[name] for r in by.values()) for name in BANDS},
            "ranked_ok": sum(r["ranked_ok"] for r in by.values()),
            "truth_a_share": round(sum(p["truth"] == 0 for p in pairs) / max(1, len(pairs)), 4)}


def ranked_ok(pair):
    """May be used in a ranked round or as the chat question: both items referenced (PREREG) and famous."""
    return pair["ref_quality"] == "referenced" and pair.get("fame", 0) >= FAME_RANKED


# --- ranked rounds and chat questions --------------------------------------------------------------------------

def add_days(date, n):
    return (datetime.date.fromisoformat(date) + datetime.timedelta(days=n)).isoformat()


def days_between(a, b):
    return abs((datetime.date.fromisoformat(a) - datetime.date.fromisoformat(b)).days)


def day_pairs(entry):
    return list(entry["ranked"]) + [entry["question"]]


def entity(item):
    """The Wikidata entity an item is about (Q-id from its statement URL), else its own id."""
    m = re.search(r"/(Q\d+)#", item.get("replaces") or item.get("source", ""))
    return m.group(1) if m else item["id"]


def extend_rounds(pairs, rounds, today, days=DAYS_AHEAD, retired_pairs=(), popularity=None, entity_of=None, ladder=None, log=None):
    """Returns a new rounds dict: the existing days unchanged plus every missing day from today to today + days, in
    order, stopping at the first day the eligible pairs cannot fill at any rung of the ladder (the result then ends the
    day before). ladder: [(item gap, pairs per category)], strictest first (default RULE_LADDER); log: a dict that gets
    {date: [item gap, pairs per category]} for each new day.
    popularity: item id -> monthly views; each day tries pairs in a random order weighted towards well-known items (a
    pair counts as known as its lesser-known item), so they come back first once the 25 days are over.
    entity_of: item id -> entity (default: the item id), for the distinct-entities rule within a day."""
    known = (lambda p: min(popularity.get(p["a_id"], 0), popularity.get(p["b_id"], 0))) if popularity else (lambda p: 1)
    ent = (lambda i: entity_of.get(i, i)) if entity_of else (lambda i: i)
    out = dict(rounds)
    by_id = {p["id"]: p for p in pairs}
    blocked = set(retired_pairs)
    eligible = {level: [p for p in pairs if ranked_ok(p) and p["id"] not in blocked and p["difficulty_hint"] == level]
                for level in RANKED_MIX}
    pair_uses, item_uses = {}, {}

    def use(date, ids):
        for pid in ids:
            pair_uses.setdefault(pid, []).append(date)
            p = by_id.get(pid)
            for i in ((p["a_id"], p["b_id"]) if p else ()):
                item_uses.setdefault(i, []).append(date)

    for date, entry in out.items():
        use(date, day_pairs(entry))

    def freedom(gap):
        def free(p, date, taken_entities):
            if ent(p["a_id"]) in taken_entities or ent(p["b_id"]) in taken_entities:
                return False
            if any(days_between(d, date) < PAIR_NO_REUSE_DAYS for d in pair_uses.get(p["id"], ())):
                return False
            return all(days_between(d, date) >= gap for i in (p["a_id"], p["b_id"]) for d in item_uses.get(i, ()))
        return free

    for k in range(days + 1):
        date = add_days(today, k)
        if date in out:
            continue
        entry = None
        # The weighted order first; a greedy dead end (the category limit and the 3/4/3 mix fight over the few famous
        # categories) gets up to RETRIES plain random orders, seeded by the date.
        for gap, cap in ladder or RULE_LADDER:
            for attempt in ["known first"] + [f"random {k}" for k in range(RETRIES)]:
                rng = random.Random(f"{date}/{attempt}" if attempt != "known first" else date)
                weight = known if attempt == "known first" else (lambda p: 1)
                order = {level: sorted(xs, key=lambda p: -weight(p) * rng.uniform(0.5, 1)) for level, xs in eligible.items()}
                entry = fill_day(date, order, pair_uses, freedom(gap), ent, cap)
                if entry:
                    break
            if entry:
                if log is not None:
                    log[date] = [gap, cap]
                break
        if entry is None:
            break  # supply exhausted: the file ends the day before
        out[date] = entry
        use(date, day_pairs(entry))
    return dict(sorted(out.items()))


def fill_day(date, order, pair_uses, free, ent, cap=MAX_PER_CATEGORY):
    """One day from the given candidate order: {"ranked", "question"}, or None when a slot cannot be filled."""
    picked, entities, per_cat = [], set(), {}

    def pick(level, limit_category):
        ok = lambda p: (free(p, date, entities) and (not limit_category or per_cat.get(p["category"], 0) < cap))
        p = next((p for p in order[level] if p["id"] not in pair_uses and ok(p)), None)  # never used beats used long ago
        p = p or next((p for p in order[level] if ok(p)), None)
        if p is None:
            return None
        entities.update((ent(p["a_id"]), ent(p["b_id"])))
        per_cat[p["category"]] = per_cat.get(p["category"], 0) + 1
        return p["id"]

    for level in ("hard", "easy", "medium"):  # scarcest first
        for _ in range(RANKED_MIX[level]):
            pid = pick(level, True)
            if pid is None:
                return None
            picked.append(pid)
    question = pick("medium", False) or pick("easy", False) or pick("hard", False)
    return {"ranked": picked, "question": question} if question else None


def format_rounds(rounds):
    """One line per day, so a swap during the nightly review is a one-line edit."""
    lines = [f'  "{d}": {{"ranked": [{", ".join(json.dumps(i) for i in e["ranked"])}], "question": {json.dumps(e["question"])}}}'
             for d, e in rounds.items()]
    return "{\n" + ",\n".join(lines) + "\n}\n"


def format_pairs(doc):
    """One pair per line (the file is long; this keeps diffs reviewable)."""
    head = {k: v for k, v in doc.items() if k != "pairs"}
    body = ",\n".join("  " + json.dumps(p, ensure_ascii=False) for p in doc["pairs"])
    return json.dumps(head, ensure_ascii=False, indent=1)[:-2] + ',\n "pairs": [\n' + body + "\n ]\n}\n"


def review_markdown(doc, rep, rounds, seed=20261003):
    lines = [f"# Comparison pairs — review ({doc['generated_at']})", "",
             "Generated by `analysis/items_pipeline/pairs.py` from `items/pool.json`. `referenced` = both items have a "
             "Wikidata reference other than a Wikipedia import, or were fact-checked by hand (only these go into ranked "
             "rounds); otherwise the weaker item's reference quality. Fame bands by the lesser item's English Wikipedia "
             "monthly views: famous >= 50,000, known 20,000-49,999, obscure below. Ranked-ready = famous and referenced.", "",
             "| Category (unit) | Pairs | famous | known | obscure | ranked-ready | referenced | imported | none | easy | medium | hard |",
             "|---|---|---|---|---|---|---|---|---|---|---|---|"]
    for name, r in rep["categories"].items():
        lines.append(f"| {name} | {r['pairs']} | {r['famous']} | {r['known']} | {r['obscure']} | {r['ranked_ok']} | {r['referenced']} | "
                     f"{r['imported']} | {r['none']} | {r['easy']} | {r['medium']} | {r['hard']} |")
    lines += ["", f"**Total: {rep['total']} pairs** over {rep['items_in_pairs']} items ({rep['usable_items']} usable; "
                  f"{rep['carried_scheduled']} scheduled pairs carried over). Correct answer is A in {rep['truth_a_share']:.1%} of pairs. "
                  f"Pairs by band: {', '.join(f'{k} {v}' for k, v in rep['pairs_by_band'].items())}; ranked-ready {rep['ranked_ok']}. "
                  f"Usable items by band: {', '.join(f'{k} {v}' for k, v in rep['usable_items_by_band'].items())}.",
              "", f"Ranked rounds and chat questions: {len(rounds)} days in `daily/rounds.json`"
                  + (f", {min(rounds)} to {max(rounds)}." if rounds else ".")
                  + (" New days by scheduling rule: " + "; ".join(f"{k}: {v}" for k, v in rep["ranked_days"]["new_days_by_rule"].items()) + "."
                     if rep.get("ranked_days") else ""), "", "## 20 random pairs", ""]
    rng = random.Random(seed)
    for p in sorted(rng.sample(doc["pairs"], min(20, len(doc["pairs"]))), key=lambda p: p["id"]):
        lines.append(f"- [ ] `{p['id']}` {p['prompt']} {p['a']} or {p['b']}? → **{'AB'[p['truth']]}** "
                     f"({p['difficulty_hint']}, {p['ref_quality']}, {p.get('fame', 0):,} views)")
    return "\n".join(lines) + "\n"


def read_json(path, default):
    if not os.path.exists(path):
        return default
    with open(path) as f:
        return json.load(f)


def runtime_rows(data):
    """wrangler d1 execute --json prints [{results: [...]}]; a plain list of rows works too."""
    return data[0]["results"] if data and isinstance(data[0], dict) and "results" in data[0] else data


def main(argv=None):
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--pool", default=os.path.join(ROOT, "items", "pool.json"))
    ap.add_argument("--out", default=os.path.join(ROOT, "items", "pairs.json"))
    ap.add_argument("--rounds", default=os.path.join(ROOT, "daily", "rounds.json"))
    ap.add_argument("--runtime", default=os.path.join(ROOT, "daily", "runtime.json"), help="items_runtime export (retired items)")
    ap.add_argument("--pair-runtime", default=os.path.join(ROOT, "daily", "pair_runtime.json"), help="pair_runtime export (retired pairs)")
    ap.add_argument("--today", default=datetime.datetime.utcnow().date().isoformat())
    ap.add_argument("--fresh", action="store_true", help="ignore the existing pairs and days (a rebuild before launch: nothing played yet)")
    args = ap.parse_args(argv)

    pool = read_json(args.pool, None)
    if pool is None:
        print(f"error: {args.pool} not found", file=sys.stderr)
        return 2
    retired = {r["item_id"] for r in runtime_rows(read_json(args.runtime, [])) if r.get("retired_at")}
    retired_pairs = {r["pair_id"] for r in runtime_rows(read_json(args.pair_runtime, [])) if r.get("retired_at")}
    rounds = {} if args.fresh else read_json(args.rounds, {})
    previous = [] if args.fresh else read_json(args.out, {"pairs": []})["pairs"]
    scheduled = {i for e in rounds.values() for i in day_pairs(e)}
    doc, rep = build_pairs(pool["items"], previous, retired, scheduled)
    levels = {}
    rounds = extend_rounds(doc["pairs"], rounds, args.today, retired_pairs=retired_pairs, popularity={it["id"]: views(it) for it in pool["items"]},
                           entity_of={it["id"]: entity(it) for it in pool["items"]}, log=levels)
    ahead = [d for d in rounds if d >= args.today]
    by_rung = {f"gap {g} days, {c} per category": sum(1 for v in levels.values() if v == [g, c]) for g, c in RULE_LADDER}
    rep["ranked_days"] = {"total": len(rounds), "from_today": len(ahead), "last": max(rounds) if rounds else None, "new_days_by_rule": by_rung}
    with open(args.out, "w") as f:
        f.write(format_pairs(doc))
    with open(args.rounds, "w") as f:
        f.write(format_rounds(rounds))
    with open(os.path.join(os.path.dirname(args.out), "pairs.REVIEW.md"), "w") as f:
        f.write(review_markdown(doc, rep, rounds))
    print(json.dumps(rep, indent=1, ensure_ascii=False), file=sys.stderr)
    return 0


if __name__ == "__main__":
    sys.exit(main())
