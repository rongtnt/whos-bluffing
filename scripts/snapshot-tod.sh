#!/usr/bin/env bash
# Records today's public numbers for Truth or Dare Bot and for Who's Bluffing into
# analysis/traction/YYYY-MM-DD.json (New York date). Re-running the same day overwrites that day's file.
# No tokens, no logins: public pages and public JSON only. Any source that fails is null, with the reason in "notes".
# Usage: bash scripts/snapshot-tod.sh
set -euo pipefail
root="$(cd "$(dirname "$0")/.." && pwd)"
day="$(TZ=America/New_York date +%F)"
out="$root/analysis/traction/$day.json"
mkdir -p "$root/analysis/traction"

python3 - "$out.tmp" <<'PY'
import json, re, sys, gzip, datetime, urllib.request, urllib.error

TOD_ID = "692045914436796436"           # Truth or Dare app id
OUR_ID = "1556371051439587461"          # Who's Bluffing? app id (discord/wrangler.toml)
UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0 Safari/537.36"
notes = []

def get(url, timeout=30):
    req = urllib.request.Request(url, headers={"User-Agent": UA, "Accept-Language": "en-US,en;q=0.9"})
    with urllib.request.urlopen(req, timeout=timeout) as r:
        raw = r.read()
    return (gzip.decompress(raw) if raw[:2] == b"\x1f\x8b" else raw).decode("utf-8", "replace")

def get_json(url):
    return json.loads(get(url))

def attempt(label, fn):
    try:
        return fn()
    except urllib.error.HTTPError as e:
        notes.append(f"{label}: HTTP {e.code}")
    except Exception as e:  # network, parse or shape errors: record and move on
        notes.append(f"{label}: {type(e).__name__}: {str(e)[:120]}")
    return None

def topgg_from_html(html):
    m = re.search(r'<script id="__NEXT_DATA__" type="application/json">(.*?)</script>', html, re.S)
    if not m:
        raise ValueError("no __NEXT_DATA__ in page")
    found = {}
    def walk(o):
        if isinstance(o, dict):
            if str(o.get("id")) == TOD_ID or str(o.get("clientid")) == TOD_ID:
                for k in ("server_count", "socialCount", "points", "monthlyPoints", "votes"):
                    if k in o and k not in found:
                        found[k] = o[k]
                rs = o.get("reviewStats")
                if isinstance(rs, dict) and "reviewCount" not in found:
                    found["reviewCount"] = rs.get("reviewCount")
            for v in o.values():
                walk(v)
        elif isinstance(o, list):
            for v in o:
                walk(v)
    walk(json.loads(m.group(1)))
    if not found:
        raise ValueError("entity not found in __NEXT_DATA__")
    return {
        "servers": found.get("server_count", found.get("socialCount")),
        "votes_all_time": found.get("points"),
        "votes_this_month": found.get("monthlyPoints", found.get("votes")),
        "reviews": found.get("reviewCount"),
    }

def topgg():
    page = f"https://top.gg/bot/{TOD_ID}"
    live = attempt("top.gg live page", lambda: topgg_from_html(get(page)))
    if live:
        return {**live, "source": page, "as_of": "live"}
    notes.append("top.gg live page is behind a Cloudflare challenge for scripts (403 on 2026-10-04); fell back to the Wayback Machine's latest copy")
    def wayback():
        snap = get_json(f"https://archive.org/wayback/available?url=top.gg/bot/{TOD_ID}")["archived_snapshots"]["closest"]
        ts = snap["timestamp"]
        data = topgg_from_html(get(f"https://web.archive.org/web/{ts}id_/{page}", timeout=90))
        return {**data, "source": f"https://web.archive.org/web/{ts}/{page}", "as_of": f"{ts[:4]}-{ts[4:6]}-{ts[6:8]}"}
    return attempt("top.gg via Wayback", wayback)

def dbl(app_id):
    d = get_json(f"https://discordbotlist.com/api/v1/bots/{app_id}")
    return {"servers": (d.get("stats") or {}).get("guilds"), "upvotes": d.get("upvotes"), "slug": d.get("slug"),
            "source": f"https://discordbotlist.com/api/v1/bots/{app_id}"}

def app_directory(app_id):
    url = f"https://discord.com/api/v9/application-directory-static/applications/{app_id}?locale=en-US"
    d = get_json(url)
    return {"servers": (d.get("directory_entry") or {}).get("guild_count"), "source": url}

def invite(code):
    url = f"https://discord.com/api/v10/invites/{code}?with_counts=true"
    d = get_json(url)
    return {"members": d.get("approximate_member_count"), "online": d.get("approximate_presence_count"), "source": url}

def x_followers(handle):
    # fxtwitter is a public third-party mirror of X profiles; x.com itself needs JavaScript and a login wall.
    url = f"https://api.fxtwitter.com/{handle}"
    u = get_json(url)["user"]
    return {"followers": u.get("followers"), "posts": u.get("tweets"), "source": url, "profile": f"https://x.com/{handle}"}

def wb_round_stats():
    url = "https://whosbluffing.com/api/round/stats"
    d = get_json(url)
    return {"date": d.get("date"), "players": d.get("players"), "source": url}

def wb_site_stats():
    url = "https://whosbluffing.com/api/stats"  # the JSON behind /stats (the /stats page itself is HTML)
    d = get_json(url)
    return {k: d.get(k) for k in ("n_sessions", "n_answers", "n_countries")} | {"source": url}

def wb_kpi():
    url = "https://whosbluffing.com/api/kpi"    # also read by /stats
    d = get_json(url)
    return {"as_of": d.get("as_of"), "mau": d.get("mau"), "dau": d.get("dau"),
            "communities": d.get("communities"), "source": url}

snap = {
    "taken_at_utc": datetime.datetime.now(datetime.timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
    "truth_or_dare": {
        "topgg": topgg(),
        "discordbotlist": attempt("ToD discordbotlist", lambda: dbl(TOD_ID)),
        "app_directory": attempt("ToD App Directory", lambda: app_directory(TOD_ID)),
        "support_server": attempt("ToD support server invite", lambda: invite("vBERMvVaRt")),
        "x": attempt("ToD X via fxtwitter", lambda: x_followers("truthordareteam")),
    },
    "whos_bluffing": {
        "round_stats": attempt("our /api/round/stats", wb_round_stats),
        "site_stats": attempt("our /api/stats", wb_site_stats),
        "kpi": attempt("our /api/kpi", wb_kpi),
        "community_server": attempt("our community invite", lambda: invite("V5wcSC7cd")),
        "x": attempt("our X via fxtwitter", lambda: x_followers("whos_bluffing")),
        "discordbotlist": attempt("our discordbotlist listing", lambda: dbl(OUR_ID)),
        "app_directory": attempt("our App Directory entry", lambda: app_directory(OUR_ID)),
    },
}
notes.append("top.gg server count has read 1,579,429 in every capture from 2025-04-21 on: it is no longer updated; use app_directory for Discord's own (rounded) count")
notes.append("top.gg for us: not read (same Cloudflare block; listing not live as of 2026-10-04)")
snap["notes"] = notes
with open(sys.argv[1], "w") as f:
    json.dump(snap, f, indent=2)
    f.write("\n")
PY
mv "$out.tmp" "$out"
echo "wrote $out"
