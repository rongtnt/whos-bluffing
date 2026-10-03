# Privacy

HowSure is an independent, unaffiliated, non-commercial project. No accounts, no advertising, no tracking scripts, no sale of data.

## Web test (howsure web)

**What is stored when you finish a test:** your answers and confidence ratings, how long each question took, the language of the test, the two-letter country code supplied by our hosting provider (never your IP address), the optional demographic answers you choose to give (age band, education, native language, region), a random session identifier, and a class code if you entered one. Nothing is stored if you close the page before the end.

**What is never stored:** IP address, browser fingerprint, device identifiers, cookies for tracking, names, emails.

**What it is used for:** the results page you see, aggregate statistics on the public stats page, and a public research dataset (see `prereg/PREREG.md`). Row-level data is anonymous and will be released openly.

**Classroom mode:** an instructor who creates a class code sees only aggregates for that class, never individual rows, and sees nothing until at least 5 students have finished.

**Retention:** indefinitely, as anonymous research data.

**Opting out:** do not press Submit, or close the page. Because sessions carry no identifier linked to you, we cannot locate a specific session afterwards to delete it.

## Anki add-on (HowSure for Anki)

**v0.1 is local only.** Your ratings are stored in a SQLite file inside the add-on's `user_files` folder on your computer. Nothing is sent anywhere. You can export or delete the file at any time.

**From v0.2, sharing is opt-in and off by default.** If you turn it on, the add-on sends: a random installation id, hashed card and deck identifiers (never card text), your rating, the grade you gave, response times, the scheduled interval, days since last review, FSRS memory state when available, interface language, add-on and Anki versions. A "Delete my data" button removes everything stored under your installation id.

## Contact

Open an issue on the GitHub repository.
