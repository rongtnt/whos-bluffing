# API

Who's Bluffing runs on a small JSON API that the web game, the Slack and Discord apps and the classroom dashboard all use. This page starts with what anyone may read, then gives the full contracts: rounds (the game today) and the retired daily game.

## Public API

One endpoint is a public read: aggregate numbers with no ids in them, free to fetch from any site.

- `GET /api/round/stats?date=YYYY-MM-DD` (date optional, default today, UTC): the ranked round of that day: players, the score histogram in 100-point bins from −3000, the mean overconfidence, `calibration` (for each confidence 50, 60 … 100%: `{conf, n, right}`, how many answers and how many of them right), and `bluffs`: up to three of the day's costliest misses at 90% or surer, one per question, each `{prompt, pick, conf, points}` (the question, the option picked, the confidence, the points it cost), empty until five people have finished the round. Cached for 60 seconds.

It answers with the header `Access-Control-Allow-Origin: *`, so a page on another site can read it with a plain `fetch`. Send simple GET requests (no custom headers). No key and no account are needed.

The other endpoints (starting a round, answers, flags, the chat apps' calls) exist for the Who's Bluffing apps. Building on them is welcome, but expect them to change without notice, keep traffic low, and never send personal data.

### Rate limits

Requests to `/api/*` are rate-limited per IP address (about 120 a minute); beyond that the API answers `429` for a minute. The numbers change at most once a minute, so cache them rather than polling.

### Attribution

If you show these numbers, please credit **Who's Bluffing** with a link to [whosbluffing.com](https://whosbluffing.com). Usage figures (players per month or day, communities) are tracked privately and are not available through the API.

## Open data

Answers are never available through the API, apart from the three anonymous bluffs above (no id, no time, nothing about who). The release plan is fixed in the pre-registration: anonymous row-level data for both studies, with every exclusion flag kept, will be published on OSF, Hugging Face and Kaggle under CC BY-NC 4.0, each release with a data card that describes how it was collected, its sample bias and what it should not be used for. Classroom sessions are pooled without class codes. Details: [Open data on the research page](/research#data) and the [pre-registration](https://github.com/rongtnt/whos-bluffing/blob/main/prereg/PREREG.md).
