Title: Show HN: HowSure – a 30-second game that finds out who's bluffing

Ten comparison questions ("Which is longer, the Nile or the Danube?"). You pick one, then stake how sure you are: 50% to 100%. The scoring rule is the quadratic one from forecasting: 50% scores zero either way, 100% right is +100, 100% wrong is −300, so honest confidence maximizes expected points. Most people discover their "90% sure" is right about 70% of the time.

At the end you get a type (Bluffer, Hot-headed, Calibrated, Modest, Hedger), a one-line roast if you earned one, and a challenge link that lets a friend play the same ten questions against your score. There's a ranked round every day and unlimited quick rounds.

Slack and Discord apps post one question a day in a channel; everyone answers, and at the reveal the channel sees who was right and the day's biggest bluff (anonymous by default; servers can turn on roast mode).

The questions are generated from Wikidata facts with the source attached to every answer; players can flag bad ones. The whole thing is also a pre-registered study: do people get better calibrated with daily feedback? The anonymous data is released under CC BY-NC and the code is published for anyone to read. No accounts, no tracking, no ads. Cloudflare Pages + Workers + D1, vanilla JS. {URL}
