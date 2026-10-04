# API

Who's Bluffing runs on a small JSON API that the web game, the Slack and Discord apps and the classroom dashboard all use. This page starts with what anyone may read, then gives the full contracts: rounds (the game today) and the retired daily game.

## Public API

Two endpoints are public reads: aggregate numbers with no ids in them, free to fetch from any site.

- `GET /api/round/stats?date=YYYY-MM-DD` (date optional, default today, UTC): the ranked round of that day: players, the score histogram in 100-point bins from −3000, and the mean overconfidence. Cached for 60 seconds.
- `GET /api/kpi`: the latest daily numbers: monthly and daily players per surface, communities per platform and the engagement rates, with the date they were computed for (`as_of`). Updated once a day after 00:10 UTC; cached for 5 minutes.

Both answer with the header `Access-Control-Allow-Origin: *`, so a page on another site can read them with a plain `fetch`. Send simple GET requests (no custom headers). No key and no account are needed.

The other endpoints (starting a round, answers, flags, the chat apps' calls) exist for the Who's Bluffing apps. Building on them is welcome, but expect them to change without notice, keep traffic low, and never send personal data.

### Rate limits

Requests to `/api/*` are rate-limited per IP address (about 120 a minute); beyond that the API answers `429` for a minute. The numbers change at most once a minute (stats) or once a day (KPI), so cache them rather than polling.

### Attribution

If you show these numbers, please credit **Who's Bluffing** with a link to [whosbluffing.com](https://whosbluffing.com). The KPI counts follow the definitions on the [research page](/research#numbers); please keep the note that someone who plays on two surfaces counts twice.

## Open data

Answers are never available through the API. The release plan is fixed in the pre-registration: anonymous row-level data for both studies, with every exclusion flag kept, will be published on OSF, Hugging Face and Kaggle under CC BY-NC 4.0, each release with a data card that describes how it was collected, its sample bias and what it should not be used for. Classroom sessions are pooled without class codes. Details: [Open data on the research page](/research#data) and the [pre-registration](https://github.com/rongtnt/whos-bluffing/blob/main/prereg/PREREG.md).
