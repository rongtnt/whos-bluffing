#!/usr/bin/env python3
"""Comparison pairs for HowSure rounds (items/pairs.json) and the daily ranked rounds and chat questions
(daily/rounds.json). Python 3.9+, standard library only. From the repo root:

    python3 analysis/items_pipeline/pairs.py

Pairs: two items of items/pool.json with the same category and unit; the larger value is at least 1.3 times the
smaller (melting points compared in kelvin), or, for years, at least 10 years apart ("Which came first?").
Left out: city populations, volatile items, retired items (daily/runtime.json, an export of items_runtime) and the
disputed items in DISPUTED. Difficulty from the ratio: >= 3 easy, 1.6-3 medium, 1.3-1.6 hard; for years from the gap:
>= 50 easy, 20-49 medium, 10-19 hard. No item is in more than 25 pairs. Ids are stable and a pair's a/b order never
changes once generated (stored answers refer to it); a new pair's order is a coin flip seeded by its two ids, so the
correct answer is A about half the time. `ref_quality` is the weaker item's (a fact-checked item counts as
referenced): `referenced` pairs are the ones ranked rounds may use.

daily/rounds.json, one line per UTC day, today to today + 120, append-only (existing days are never changed):
{"ranked": [10 pair ids], "question": pair id}. Ranked: only `referenced` pairs, at most 2 per category, 3 easy +
4 medium + 3 hard. Question: one more `referenced` pair (medium when possible) for the Slack and Discord daily
question, never one of that day's ranked pairs; a day's 11 pairs are about 22 different entities (no "Mercury" twice
through its diameter and its distance). No pair on two days within 180 days, no item on two days within 25.
(The brief asked for 30 days, but a day uses 22 items and the pool has about 650 referenced or fact-checked items
outside city populations, fewer than the 660 a 30-day gap needs; 25 is the longest gap that fills 121 days.)
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
EXCLUDED_CATEGORIES = {"city_population"}
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


def usable(item, retired):
    """Items that may appear in a pair (see the module docstring)."""
    if item["category"] in EXCLUDED_CATEGORIES or item.get("volatile") or item["id"] in retired or item["id"] in DISPUTED:
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


def candidates(items):
    """Every valid pair within each (category, unit) group: [(key, ratio, gap, difficulty, both referenced)]."""
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
                    out.append((pair_key(a["id"], b["id"]), m[0], m[1], difficulty(*m), both))
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
    """Greedy, maximal under the per-item cap: previously generated pairs first, then pairs of two referenced items
    (the only ones ranked rounds can use, and the scarcer kind), then the rest; the difficulty classes interleaved
    so each item's 25 slots get a mix."""
    rng = random.Random(seed)
    cands = sorted(cands)
    order = ([c for c in cands if c[0] in preferred]
             + interleave([c for c in cands if c[0] not in preferred and c[4]], rng)
             + interleave([c for c in cands if c[0] not in preferred and not c[4]], rng))
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
                 "difficulty_hint": level, "ref_quality": weaker})
    return pair


def report(pairs, items, carried):
    by = {}
    for p in pairs:
        row = by.setdefault(f"{p['category']} ({p['unit']})", {"pairs": 0, "referenced": 0, "imported": 0, "none": 0,
                                                              "easy": 0, "medium": 0, "hard": 0})
        row["pairs"] += 1
        row[p["ref_quality"]] += 1
        row[p["difficulty_hint"]] += 1
    in_pairs = {i for p in pairs for i in (p["a_id"], p["b_id"])}
    return {"categories": dict(sorted(by.items())), "total": len(pairs), "usable_items": len(items),
            "items_in_pairs": len(in_pairs), "carried_scheduled": len(carried),
            "truth_a_share": round(sum(p["truth"] == 0 for p in pairs) / max(1, len(pairs)), 4)}


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


def extend_rounds(pairs, rounds, today, days=DAYS_AHEAD, retired_pairs=(), popularity=None, entity_of=None):
    """Returns a new rounds dict: the existing days unchanged plus every missing day from today to today + days.
    popularity: item id -> Wikipedia sitelinks; each day tries pairs in a random order weighted towards well-known
    items (a pair counts as known as its lesser-known item), so they come back first once the 25 days are over.
    entity_of: item id -> entity (default: the item id), for the distinct-entities rule within a day.
    Raises ValueError when the eligible pairs cannot fill a day."""
    known = (lambda p: min(popularity.get(p["a_id"], 0), popularity.get(p["b_id"], 0))) if popularity else (lambda p: 1)
    ent = (lambda i: entity_of.get(i, i)) if entity_of else (lambda i: i)
    out = dict(rounds)
    by_id = {p["id"]: p for p in pairs}
    blocked = set(retired_pairs)
    eligible = {level: [p for p in pairs if p["ref_quality"] == "referenced" and p["id"] not in blocked and p["difficulty_hint"] == level]
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

    def free(p, date, taken_entities):
        if ent(p["a_id"]) in taken_entities or ent(p["b_id"]) in taken_entities:
            return False
        if any(days_between(d, date) < PAIR_NO_REUSE_DAYS for d in pair_uses.get(p["id"], ())):
            return False
        return all(days_between(d, date) >= ITEM_NO_REUSE_DAYS for i in (p["a_id"], p["b_id"]) for d in item_uses.get(i, ()))

    for k in range(days + 1):
        date = add_days(today, k)
        if date in out:
            continue
        entry = None
        for attempt in ("known first", "random"):  # a day the weighted order cannot fill gets one plain random try
            rng = random.Random(f"{date}/{attempt}" if attempt == "random" else date)
            weight = known if attempt == "known first" else (lambda p: 1)
            order = {level: sorted(xs, key=lambda p: -weight(p) * rng.uniform(0.5, 1)) for level, xs in eligible.items()}
            entry = fill_day(date, order, pair_uses, free, ent)
            if entry:
                break
        if entry is None:
            raise ValueError(f"not enough eligible pairs for {date} (no ranked round of 3 easy + 4 medium + 3 hard "
                             f"with at most {MAX_PER_CATEGORY} per category and no item used within {ITEM_NO_REUSE_DAYS} days)")
        out[date] = entry
        use(date, day_pairs(entry))
    return dict(sorted(out.items()))


def fill_day(date, order, pair_uses, free, ent):
    """One day from the given candidate order: {"ranked", "question"}, or None when a slot cannot be filled."""
    picked, entities, per_cat = [], set(), {}

    def pick(level, limit_category):
        ok = lambda p: (free(p, date, entities) and (not limit_category or per_cat.get(p["category"], 0) < MAX_PER_CATEGORY))
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
             "rounds); otherwise the weaker item's reference quality.", "",
             "| Category (unit) | Pairs | referenced | imported | none | easy | medium | hard |", "|---|---|---|---|---|---|---|---|"]
    for name, r in rep["categories"].items():
        lines.append(f"| {name} | {r['pairs']} | {r['referenced']} | {r['imported']} | {r['none']} | {r['easy']} | {r['medium']} | {r['hard']} |")
    lines += ["", f"**Total: {rep['total']} pairs** over {rep['items_in_pairs']} items ({rep['usable_items']} usable; "
                  f"{rep['carried_scheduled']} scheduled pairs carried over). Correct answer is A in {rep['truth_a_share']:.1%} of pairs.",
              "", f"Ranked rounds and chat questions: {len(rounds)} days in `daily/rounds.json`"
                  + (f", {min(rounds)} to {max(rounds)}." if rounds else "."), "", "## 20 random pairs", ""]
    rng = random.Random(seed)
    for p in sorted(rng.sample(doc["pairs"], min(20, len(doc["pairs"]))), key=lambda p: p["id"]):
        lines.append(f"- [ ] `{p['id']}` {p['prompt']} {p['a']} or {p['b']}? → **{'AB'[p['truth']]}** "
                     f"({p['difficulty_hint']}, {p['ref_quality']})")
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
    args = ap.parse_args(argv)

    pool = read_json(args.pool, None)
    if pool is None:
        print(f"error: {args.pool} not found", file=sys.stderr)
        return 2
    retired = {r["item_id"] for r in runtime_rows(read_json(args.runtime, [])) if r.get("retired_at")}
    retired_pairs = {r["pair_id"] for r in runtime_rows(read_json(args.pair_runtime, [])) if r.get("retired_at")}
    rounds = read_json(args.rounds, {})
    previous = read_json(args.out, {"pairs": []})["pairs"]
    scheduled = {i for e in rounds.values() for i in day_pairs(e)}
    doc, rep = build_pairs(pool["items"], previous, retired, scheduled)
    try:
        popularity = {it["id"]: it.get("sitelinks", 0) for it in pool["items"]}
        rounds = extend_rounds(doc["pairs"], rounds, args.today, retired_pairs=retired_pairs, popularity=popularity,
                               entity_of={it["id"]: entity(it) for it in pool["items"]})
    except ValueError as e:
        print(f"error: {e}; nothing written", file=sys.stderr)
        return 1
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
