# Privacy

HowSure is an independent, unaffiliated, non-commercial project. No accounts, no advertising, no tracking scripts, no sale of data.

## Web (daily game and full assessment)

**Daily game:** each completed play stores your anonymous id, the UTC date, which surface you played on (web, Slack, classroom), your five ranges, whether each contained the truth, response times, and the day's score. The anonymous id lives in your browser's local storage so your streak and personal calibration curve persist; clearing site data resets it. Flagging a question stores your anonymous id with the flag so each person counts once.

**Full assessment — what is stored when you finish:** your answers and confidence ratings, how long each question took, the language of the test, the two-letter country code supplied by our hosting provider (never your IP address), the optional demographic answers you choose to give (age band, education, native language, region), a random session identifier, and a class code if you entered one. Nothing is stored if you close the page before the end.

**What is never stored:** IP address, browser fingerprint, device identifiers, cookies for tracking, names, emails.

**Repeat visits:** your browser keeps a random id (not linked to you) so that later sessions from the same browser can be tied together. This is what makes streaks and the practice-effect analysis possible, and it lets the research analysis keep only one full assessment per browser. Clearing site data removes it.

**What it is used for:** the results page you see, aggregate statistics on the public stats page, and a public research dataset (see `prereg/PREREG.md`). Row-level data is anonymous and will be released openly.

**Classroom mode:** an instructor who creates a class code sees only aggregates for that class, never individual rows, and sees nothing until at least 5 students have finished.

**Slack and Discord:** the chat apps store, per workspace or server, its id, the chosen channel, the bot token, the posting hour, the roast-mode setting, the ids of the messages they posted, and each day's answers (choice, confidence, points, right or wrong) keyed by a salted hash of the member id. They never store message text, names or emails; display names are fetched from the platform only while drawing a leaderboard or recap. With roast mode off (the default) nobody is named next to a wrong answer.

**Public numbers:** monthly and daily active players are computed from anonymous ids once a day and published on the stats page using the definitions in `prereg/PREREG.md`.

**Retention:** indefinitely, as anonymous research data.

**Opting out:** do not press Submit, or close the page. Because sessions carry no identifier linked to you, we cannot locate a specific session afterwards to delete it.

## Anki add-on (HowSure for Anki)

**v0.1 is local only.** Your ratings are stored in a SQLite file inside the add-on's `user_files` folder on your computer. Nothing is sent anywhere. You can export or delete the file at any time.

**From v0.2, sharing is opt-in and off by default.** If you turn it on, the add-on sends: a random installation id, hashed card and deck identifiers (never card text), your rating, the grade you gave, response times, the scheduled interval, days since last review, FSRS memory state when available, interface language, add-on and Anki versions. A "Delete my data" button removes every rating stored under your installation id; the server keeps only the id and the deletion time so that later uploads from that installation are refused, and the add-on then switches to a fresh id if you ever opt in again.

## Contact

Open an issue on the GitHub repository.
