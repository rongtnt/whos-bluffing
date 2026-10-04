#!/usr/bin/env python3
"""Writes a review of ranked days for hand curation (from the repo root):

    python3 analysis/items_pipeline/launch_review.py --from 2026-10-04 --to 2026-10-18 [--out daily/LAUNCH_REVIEW.md]

Per day: the 10 ranked pairs and the chat question with both names, both values, the unit, the difficulty, the right
answer and both source links, plus flags for what deserves a second look:
  contested  the item's notes say sources disagree or the definition varies, or a curated launch year depends on the
             event chosen (another year is named in its note)
  stale      a population or speaker count from before 2020, or the two figures of a pair from years 5+ apart
  ambiguous  the name is shared by another entity in the pool
  repeat     an entity also appears on another ranked day less than 7 days away (twice in one week)
  close      a hard pair compared on estimated figures (populations, speakers)
"""
import argparse
import datetime
import json
import os
import re
import sys

ROOT = os.path.normpath(os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", ".."))
CONTESTED = re.compile(r"disagree|definition|depends on|low priority|ambigu", re.I)
UNDECIDED = re.compile(r"\bCHECK, kept")  # fact-check rows left ambiguous (case-sensitive: "fact-check" is not a flag)
ESTIMATES = {"country_population", "language_speakers"}
STALE_BEFORE = 2020
YEARS_APART = 5
WEEK = 7


def entity(item):
    m = re.search(r"/(Q\d+)#", item.get("replaces") or item.get("source", ""))
    return m.group(1) if m else item["id"]


def stated_year(item):
    m = re.search(r"\bin (\d{4})\?$", item["en"]["prompt"])
    return int(m.group(1)) if m else None


def fmt(value, unit):
    if unit == "year":
        return f"{-value} BC" if value < 0 else str(value)
    return f"{value:,} {unit}" if isinstance(value, int) or float(value).is_integer() else f"{value:,} {unit}"


def norm_name(name):
    return re.sub(r"^the ", "", name.strip().lower())


def flags_for(pair, a, b, date, uses_by_entity, entities_by_name):
    out = []
    for it in (a, b):
        notes = it.get("notes") or ""
        if notes.startswith("curated launch year"):
            other = [y for y in re.findall(r"\b(1[5-9]\d\d|20\d\d)\b", notes) if int(y) != it["answer"]]
            if other:
                out.append(f"contested: {it['name']} launch year depends on the event ({notes.split(': ', 1)[1]})")
        elif CONTESTED.search(notes) or UNDECIDED.search(notes):
            out.append(f"contested: {it['name']}: {notes.split(' | ')[-1][:160]}")
        if len(entities_by_name.get(norm_name(it["name"]), ())) > 1:
            out.append(f"ambiguous: another entity in the pool is also called {it['name']}")
        other_days = sorted(d for d in uses_by_entity.get(entity(it), ()) if d != date and abs((datetime.date.fromisoformat(d) - datetime.date.fromisoformat(date)).days) < WEEK)
        if other_days:
            out.append(f"repeat: {it['name']} also on {', '.join(other_days)}")
    if pair["category"] in ESTIMATES:
        ya, yb = stated_year(a), stated_year(b)
        old = [f"{it['name']} {y}" for it, y in ((a, ya), (b, yb)) if y and y < STALE_BEFORE]
        if old:
            out.append(f"stale: figures from {', '.join(old)}")
        if ya and yb and abs(ya - yb) >= YEARS_APART:
            out.append(f"stale: figures from different years ({ya} vs {yb})")
        if pair["difficulty_hint"] == "hard":
            out.append(f"close: hard pair (ratio {pair['ratio']}) on estimated figures")
    return out


def review(pool, pairs, rounds, start, end):
    """The markdown text for the ranked days from start to end (inclusive)."""
    items = {it["id"]: it for it in pool}
    by_id = {p["id"]: p for p in pairs}
    uses = {}
    for d, e in rounds.items():
        for pid in list(e["ranked"]) + [e["question"]]:
            p = by_id[pid]
            for i in (p["a_id"], p["b_id"]):
                uses.setdefault(entity(items[i]), set()).add(d)
    names = {}
    for it in pool:
        names.setdefault(norm_name(it.get("name") or ""), set()).add(entity(it))
    days = [d for d in sorted(rounds) if start <= d <= end]
    body, counts = [], {}

    def row(n, pid, date):
        p = by_id[pid]
        a, b = items[p["a_id"]], items[p["b_id"]]
        fl = flags_for(p, a, b, date, uses, names)
        for f in fl:
            counts[f.split(":")[0]] = counts.get(f.split(":")[0], 0) + 1
        right = "AB"[p["truth"]]
        return (f"| {n} | `{pid}` | {p['prompt']} | {a['name']}: {fmt(a['answer'], p['unit'])} | {b['name']}: {fmt(b['answer'], p['unit'])} "
                f"| {right} | {p['difficulty_hint']} | [A]({a['source']}) [B]({b['source']}) | {'<br>'.join('⚠ ' + f for f in fl)} |")

    for d in days:
        e = rounds[d]
        weekday = datetime.date.fromisoformat(d).strftime("%A")
        body += [f"## {d} ({weekday})", "", "| # | Pair | Question | A | B | Right | Level | Sources | Flags |", "|---|---|---|---|---|---|---|---|---|"]
        body += [row(k + 1, pid, d) for k, pid in enumerate(e["ranked"])]
        body += [row("Q", e["question"], d), ""]
    head = [f"# Launch review: ranked days {start} to {end}", "",
            f"Generated by `analysis/items_pipeline/launch_review.py` from `daily/rounds.json`, `items/pairs.json` and `items/pool.json`. "
            "Rows 1-10 are the ranked round (in file order; players see them shuffled), row Q the Slack/Discord daily question. "
            "To swap a pair, replace its id in `daily/rounds.json` with another ranked-ready pair of the same difficulty "
            "(both items with 50,000+ monthly views, referenced or fact-checked, no `ranked_ok: false`), then `npm run sync-items`.", "",
            f"**{len(days)} days, flags:** " + (", ".join(f"{k} {v}" for k, v in sorted(counts.items())) or "none") + ".", "",
            "Flags: **contested** sources disagree, the definition varies, or a launch year depends on the event chosen; "
            f"**stale** population or speaker figures from before {STALE_BEFORE} or from years {YEARS_APART}+ apart; **ambiguous** the "
            f"name is shared by another entity in the pool; **repeat** the entity is asked again less than {WEEK} days away; "
            "**close** a hard pair on estimated figures.", ""]
    return "\n".join(head + body) + "\n"


def main(argv=None):
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--from", dest="start", required=True)
    ap.add_argument("--to", dest="end", required=True)
    ap.add_argument("--out", default=os.path.join(ROOT, "daily", "LAUNCH_REVIEW.md"))
    ap.add_argument("--extra", help="markdown file appended at the end (e.g. notes on days already served)")
    args = ap.parse_args(argv)
    read = lambda p: json.load(open(os.path.join(ROOT, p)))
    text = review(read("items/pool.json")["items"], read("items/pairs.json")["pairs"], read("daily/rounds.json"), args.start, args.end)
    if args.extra:
        with open(args.extra) as f:
            text += "\n" + f.read()
    with open(args.out, "w") as f:
        f.write(text)
    print(f"wrote {args.out}", file=sys.stderr)
    return 0


if __name__ == "__main__":
    sys.exit(main())
