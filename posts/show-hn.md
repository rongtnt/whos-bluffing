Title: Show HN: HowSure – a daily 30-second game that measures how overconfident you are

Five questions a day, same for everyone. For each one you give a range you're 90% sure contains the answer ("How tall is Angel Falls, in metres?"). Then you see the truth, the source, and whether you were inside. Most people get 2 or 3 of 5 — at "90% sure".

Share grid like Wordle (🟩🟩🟥🟩🟩 4/5), streaks, and a personal calibration curve that builds over days. There's a Slack app that posts the day's game to a channel with a team leaderboard, and a classroom mode for instructors.

Why I built it: I wanted a dataset nobody has — does getting daily feedback actually make people better calibrated? Hypotheses were published before launch; anonymous data and code are open. No accounts, no tracking, no ads. Cloudflare Pages + Workers + D1, vanilla JS; every question comes from Wikidata or an official source with the link attached, and players can flag bad ones.

Prior art I learned from: Quantified Intuitions' Estimation Game and Calibration Training. {URL}
