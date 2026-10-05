# Politics pack: notes (built 2026-10-05)

File: `items/politics_curated.json`, same layout as `items/ai_curated.json` (an `about` header, `checked_at`, one item per line). 275 items, all `fact_checked: true`. Nothing in `web/` or the pipeline code was changed, so the pack is not wired in yet (see "To wire it in").

## Counts

| Category | Items | Minimum | Party split | Tiers |
|---|---|---|---|---|
| pol_elected | 64 | 60 | 31 D, 1 I (Sanders, caucuses with D), 32 R | all 1 |
| pol_timeline | 62 | 50 | 18 D, 17 R, 27 both | 13 at 1, 46 at 2, 3 at 3 |
| pol_numbers | 64 | 50 | 23 D, 24 R, 17 both | 14 at 2, 50 at 3 |
| pol_money | 41 | 30 | 17 D, 20 R, 4 both | 37 at 2, 4 at 3 |
| pol_drama | 44 | 40 (20 per party) | 22 D, 22 R | all 2 |

Balance rule: pol_elected D 31 vs R 32 (D+I 32 vs R 32); pol_drama 22 vs 22. Every pol_elected and pol_drama `note` starts with the party (the party at the time of the event for drama), so the split can be counted from the file.

## How each value was checked

- A scratch verifier fetched every `source`, decoded its `#:~:text=` fragment, and passed an item only when the fragment was on the page and the value (year, "Month YYYY", number, dollar figure) sat inside it. Pages that block scripts (congress.gov, cbo.gov, justice.gov) were read in the browser on 2026-10-05; the passages read were saved and checked the same way.
- Every drama `fun` line was checked against the pages named in its `note` (phrase by phrase).
- Some fragments span table cells (FEC totals, Senate "Vote Counts") or sit in PDFs (Senate Ethics letters, FEC results, a Ninth Circuit opinion). The value is there, but a browser may not highlight it.
- The scratch tooling and a copy of `test_the_ai_file_is_clean` adapted to `pol_*` (category minimums, money date-in-name, no date in timeline or drama names, balance, required names) live in the session scratchpad, not in the repo. All checks pass.

## `famous`

Set on every pol_drama item (true or false, as in the fixture) and, as `false` only, on 32 pol_elected members. pol_timeline, pol_numbers and pol_money keep the tier default, as in the AI pack and the fixture. By the same pageview window, 78 of their 107 tier 1-2 items with a qid average under 50,000 views (old events' articles are read less now: the Affordable Care Act article averages 21,279, Obergefell v. Hodges 21,316), so a flag there would mostly hide well-known events. Politics items never take ranked slots (`pairs.py`), so the flag only sorts quick rounds between easy and normal.

## pol_elected

- Value: the year the member first won election to the chamber in the name, not the swearing-in year. Specials and runoffs count: Booker 2013, Kelly 2020, Pelosi 1987, Scalise 2008, Warnock and Ossoff 2021 (the Georgia runoffs of 5 January 2021). Appointed senators count from their first election: Padilla 2022, Murkowski 2004, Tim Scott 2014. Appointed senators who have not won an election yet are left out.
- Sitting check: the Clerk's member list (published 1 October 2026) and senate.gov's senator list, then each member's congress.gov page ("In Congress YYYY - Present") for all 64 plus 6 spares.
- Named people resolved as: Murphy = Chris (D-CT), Kelly = Mark (D-AZ), Lee = Mike (R-UT), Johnson = Mike (R-LA), Kennedy = John (R-LA), Paul = Rand, Graham = Lindsey.
- Dropped because they no longer sit: **Lindsey Graham** (named; congress.gov "In Congress 1995 - 2026"; Darline Graham has held the seat since 2026). Also, from my own extra picks: Markwayne Mullin ("2013 - 2026") and Eric Swalwell ("2013 - 2026").
- Sources: Wikipedia sentences stating the election year. For Fetterman, Warnock and Scalise, the election article gives the clearest sentence.
- `famous: false` on 32 members whose article averaged under 50,000 user views a month over July-September 2026, the same window and threshold as `pageviews.py` (`--today 2026-10-04`). They include 8 of the 23 named members: Elizabeth Warren, Adam Schiff, Chris Murphy, Mike Lee, Tom Cotton, Jim Jordan, Dan Crenshaw, Elise Stefanik. Remove the flag if the named list should count as famous regardless.
- Spares, checked as sitting but not used: Chris Van Hollen, Sheldon Whitehouse, Andy Kim (D); Bill Cassidy, Mike Lawler, Brian Fitzpatrick (R).

## pol_timeline

Laws (16), shutdowns begun and ended (6), impeachment votes and verdicts (7), Speaker elections and the removal of a Speaker (7), Supreme Court decisions (14), changes of party control (7), nuclear options and nominations (4), and the Capitol storming (1), all from October 1996 to February 2026. Months for control changes: Jeffords is June 2001 (the change took effect then; he announced on 24 May); Georgia is January 2021 (the runoffs and the swearing-in). `_party` rule used for the split: a law takes its president's party unless it was a cross-party deal or passed with broad votes from both parties; courts and shutdowns count as both.

## pol_numbers

| unit | items | sanity range used in the scratch check |
|---|---|---|
| electoral votes | 16 | 1-538 |
| House seats | 8 | 1-435 |
| yea votes | 19 | 0-435 |
| guilty votes | 2 | 0-100 |
| popular votes | 7 | 1e5-2e8 |
| years old | 7 | 18-110 |
| years | 5 | 1-80 |

The pipeline asks "{name}: how many {unit}?", so the two Senate impeachment verdicts use the unit "guilty votes" (the Senate counts Guilty and Not Guilty, not yeas). No two items in a unit share an answer. Two House votes were recorded as "ayes" (their names say so) and stay under "yea votes". Weaker sources, noted: Byrd's 51 years comes from a table cell, Dingell's 59 from "more than 59 years", 2018 Democratic seats (235) from an article footnote, and 2010 Republican seats (242) and 2024 Democratic seats (215) from the 112th and 119th Congress articles.

## pol_money

- 34 FEC items: two-year committee pages, total receipts ("raised") or, for Bloomberg, total disbursements ("spent"). `as_of` is the end of the coverage shown on the page. Names follow each page's header, for example "Never Surrender, Inc. (formerly Donald J. Trump for President 2024, Inc.)" and "FF PAC (Future Forward)". Harris is the 2023-2024 committee page ($1,175,189,365.41), not the 2021-2024 candidate view. McCain 2008 covers his primary committee only. Warnock uses the page covering December 2020 to December 2022. Cruz 2017-2018 is the page value ($35.4 million), which is lower than some press figures.
- 7 CBO items: the FY2025 deficit, four estimates for Public Law 119-21 (deficit increase, spending cut, revenue cut, added interest), and the FY2026 and FY2036 projected deficits.
- Not sourced: "largest disclosed donations". FEC itemized receipts are rendered by JavaScript and could not be read reliably, so no donation items were made.

## pol_drama

- Sources: the House Historian's expulsion, censure and reprimand table (12), Justice Department releases (16), with the Pardon Attorney's clemency list for outcomes, senate.gov (6), congress.gov resolution texts with Clerk roll calls (3), Clerk vacancy and roll-call pages (3), Senate Ethics letters (2), and two news items, each with two outlets: Pelosi (NBC News, CBS News) and Cheney (CBS News, NPR).
- Outcomes are stated where documented: Santos's sentence was commuted (17 October 2025); Fortenberry's conviction was reversed on venue (26 December 2023); Cuellar was pardoned before sentencing (2 December 2025); Corrine Brown's first conviction was vacated before her 2022 plea; the Stevens case was dismissed (1 April 2009).
- `famous` is true for 9 items (subject's article at 50,000+ monthly views in July-September 2026): Santos (3), Cruz, McCain, Omar, Pelosi, Sinema, Booker.
- Left out under the private-life and allegation rules: the April 2026 resignations of Eric Swalwell and Tony Gonzales (misconduct allegations), Chuck Edwards's censure of 1 September 2026 (harassment of staff), and resignations tied to private conduct (Weiner, Franken, Conyers, Gaetz and others). Also left out: LaMonica McIver's case (no outcome yet).
- Left out for lack of a reachable official source: Elizabeth Warren's Rule XIX moment (the Senate vote pages do not name her, and the Congressional Record could not be fetched), Jim Inhofe's snowball, Rand Paul's 2013 filibuster, Chris Murphy's 2016 filibuster, and the McCarthy and Jeffries record House speeches. Jeffords's switch is covered in pol_timeline instead.

## Pipeline check

`POL_CATEGORIES` is already in `wikidata_pool.py`. The file passes `test_wikidata_pool.PoliticsPack` (including `test_the_real_file_is_clean_when_it_exists`), and `python3 -m unittest discover -s analysis/items_pipeline` runs 75 tests, all OK, on 2026-10-05. The pool, pairs and rounds were not rebuilt here (AI_WEEKLY.md steps 6-8).
