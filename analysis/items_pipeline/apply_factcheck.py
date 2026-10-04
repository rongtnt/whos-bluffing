#!/usr/bin/env python3
"""Applies an item fact-check report to items/pool.json (from the repo root):

    python3 analysis/items_pipeline/apply_factcheck.py [--report analysis/factcheck-famous-2026-10-04.json]

Report rows: {id, verdict: OK|CHECK|WRONG, our_value, better_value, better_source, note}. Every touched item gets a
`notes` line, which pins it (wikidata_pool.py keeps it verbatim on the next regeneration).
  OK     -> fact_checked: true.
  WRONG  -> answer = better_value, source = better_source (the old Wikidata statement kept in `replaces`), fact_checked.
  CHECK  -> by the coordinator's decision for the 2026-10-04 report (the id lists below; a CHECK row in none of them is
            an error, so a new report needs its own decision): AMBIGUOUS = definition or figure unclear: kept for quick
            rounds, `ranked_ok: false`, `fact_checked: false`; ADOPT = small gap to the official figure: as WRONG;
            RETIRE = ill-posed: `retired_at`.
Rows already applied (their marker is in the item's notes) are skipped, so a second run changes nothing.
"""
import argparse
import datetime
import json
import os
import re
import sys

ROOT = os.path.normpath(os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", ".."))
DEFAULT_REPORT = os.path.join(ROOT, "analysis", "factcheck-famous-2026-10-04.json")

# Decisions for the CHECK rows of analysis/factcheck-famous-2026-10-04.json (coordinator, 2026-10-04).
AMBIGUOUS = {
    "w0025": "Israel", "w0046": "Pakistan", "w0097": "United Arab Emirates", "w0194": "Macau", "w0165": "Nicaragua",
    "w0001": "France incl. overseas regions", "w0225": "US Virgin Islands", "w0124": "Eritrea", "w0215": "French Polynesia",
    "w2416": "Nigeria", "w1619": "Boeing 707 (prototype vs production)", "w1623": "Dassault Rafale", "w1653": "Sukhoi Su-35",
    "w1668": "Starship", "w2625": "KFC", "w2684": "Yandex", "w2627": "Ferrari", "w2749": "Bank of America",
    "w2758": "Minecraft", "w2761": "TikTok", "w2415": "Saudi Arabia", "w2486": "Tajikistan", "w2491": "Rwanda",
    "w2489": "Mauritania", "w2521": "Papua New Guinea",
}
ADOPT = {
    "w0175": "Barbados", "w0176": "São Tomé and Príncipe", "w0190": "Saint Kitts and Nevis", "w0185": "Tuvalu",
    "w3077": "Colosseum (80)", "w2984": "Colossus of Rhodes height (32 m)", "w3083": "Colossus of Rhodes (282 BCE)",
    "w1364": "Tokyo 2022",
}
RETIRE = {"w1643": "Air Force One is a call sign, not an aircraft"}
WIKIDATA_STATEMENT = re.compile(r"^https://www\.wikidata\.org/wiki/Q\d+#P\d+$")


def https(url):
    """web.archive.org links sometimes come as http://; the same resource is served over https."""
    return re.sub(r"^http://web\.archive\.org/", "https://web.archive.org/", url)


def corrected(it, row, label):
    out = dict(it, answer=row["better_value"], source=https(row["better_source"]))
    if not it.get("replaces") and WIKIDATA_STATEMENT.match(it["source"]):
        out["replaces"] = it["source"]
    return out, f"{label}, was {row['our_value']}: {row['note']}"


def apply(items, report, today=None):
    """Returns (new items, counts by action). Raises ValueError for an unknown id or an undecided CHECK row."""
    today = today or datetime.date.today().isoformat()
    marker = f"fact-check {os.path.basename(report.get('_file', 'report'))}"
    by_id = {it["id"]: it for it in items}
    counts = {}
    for row in report["items"]:
        it = by_id.get(row["id"])
        if it is None:
            raise ValueError(f"{row['id']} is not in the pool")
        if marker in (it.get("notes") or ""):
            counts["already applied"] = counts.get("already applied", 0) + 1
            continue
        verdict = row["verdict"]
        flags = {}
        if verdict == "OK":
            new, note, action = dict(it), "OK", "ok"
        elif verdict == "WRONG" or (verdict == "CHECK" and row["id"] in ADOPT):
            (new, note), action = corrected(it, row, verdict), "corrected"
        elif verdict == "CHECK" and row["id"] in AMBIGUOUS:
            new, note, action = dict(it), f"CHECK, kept out of ranked rounds: {row['note']}", "ambiguous"
            flags = {"ranked_ok": False}
        elif verdict == "CHECK" and row["id"] in RETIRE:
            new, note, action = dict(it), f"CHECK, retired: {RETIRE[row['id']]}. {row['note']}", "retired"
            flags = {"ranked_ok": False, "retired_at": today}
        else:
            raise ValueError(f"{row['id']}: no decision for verdict {verdict}")
        new.update(flags, fact_checked=flags.get("ranked_ok", True) is not False)
        new["notes"] = " | ".join(x for x in (it.get("notes"), f"{marker} ({today}): {note}") if x)
        by_id[row["id"]] = new
        counts[action] = counts.get(action, 0) + 1
    return [by_id[it["id"]] for it in items], counts


def main(argv=None):
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--report", default=DEFAULT_REPORT)
    ap.add_argument("--pool", default=os.path.join(ROOT, "items", "pool.json"))
    ap.add_argument("--today", default=datetime.datetime.utcnow().date().isoformat())
    args = ap.parse_args(argv)
    with open(args.report) as f:
        report = dict(json.load(f), _file=args.report)
    with open(args.pool) as f:
        pool = json.load(f)
    try:
        items, counts = apply(pool["items"], report, args.today)
    except ValueError as e:
        print(f"error: {e}; the pool was not changed", file=sys.stderr)
        return 1
    with open(args.pool, "w") as f:
        json.dump(dict(pool, items=items), f, ensure_ascii=False, indent=1)
        f.write("\n")
    print(json.dumps(counts), file=sys.stderr)
    return 0


if __name__ == "__main__":
    sys.exit(main())
