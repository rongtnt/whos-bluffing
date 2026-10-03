"""Reviewer integration: rating bar, rating keys, one local row per rated answer.

Flow: question shown -> 1-5 (key or button) stores a pending rating plus a snapshot
of the card's scheduling state, then reveals the answer -> the answer grade writes
one row. Answers without a rating only bump a counter. Card content is never read
into the row."""
import json
import os
import sqlite3
import time
from collections.abc import Callable
from contextlib import closing
from datetime import datetime, timezone

import anki.lang
from anki.buildinfo import version as ANKI_VERSION
from anki.cards import Card
from anki.collection import Collection
from aqt import mw
from aqt.reviewer import Reviewer

from . import i18n, store

ADDON_VERSION = "0.1.0"
DB_PATH = os.path.join(os.path.dirname(__file__), "user_files", "howsure.sqlite")
UNRATED = "unrated_answers"
DAY_MS = 86_400_000

_question_shown = None  # time.monotonic() when the question appeared
_answer_shown = None    # time.monotonic() when the answer appeared
_pending = None         # rating for the card on screen, until it is answered


def config() -> dict:
    return mw.addonManager.getConfig(__name__)


def lang() -> str:
    return i18n.resolve(config()["language"], anki.lang.current_lang)


def db() -> closing[sqlite3.Connection]:
    # ponytail: one short connection per operation; no handle stays open (safe for add-on updates).
    return closing(store.connect(DB_PATH))


def _elapsed_ms(since: float | None) -> int | None:
    return None if since is None else round((time.monotonic() - since) * 1000)


def _eval(js: str) -> None:
    mw.reviewer.web.eval(f"window.howsure && {js}")


def snapshot(col: Collection, card: Card, now_ms: int) -> dict:
    """Scheduling state when the rating is given. After the answer, card.ivl and
    memory_state already include the new grade and retrievability is ~1, so it is
    read here, before answering."""
    last = col.db.scalar("SELECT max(id) FROM revlog WHERE cid = ? AND ease > 0", card.id)
    stats = col.card_stats_data(card.id)
    mem = card.memory_state
    return {
        "ivl_days": card.ivl,
        "reps": card.reps,
        "lapses": card.lapses,
        "days_since_last_review": None if last is None else max(0.0, (now_ms - last) / DAY_MS),
        "stability": mem.stability if mem else None,
        "difficulty": mem.difficulty if mem else None,
        "retrievability": stats.fsrs_retrievability if stats.HasField("fsrs_retrievability") else None,
    }


def rate(n: int) -> None:
    """Store a pending rating for the card on screen; reveal the answer unless configured off."""
    global _pending
    reviewer = mw.reviewer
    if reviewer.state != "question" or reviewer.card is None:
        return
    reveal = config()["reveal_on_rate"]
    if reveal and _pending is not None:
        return  # answer is already being revealed; ignore a double press
    card = reviewer.card
    _pending = {
        "card_id": card.id,
        "jol": n,
        "q_rt_ms": _elapsed_ms(_question_shown),
        **snapshot(mw.col, card, int(time.time() * 1000)),
    }
    _eval(f"howsure.mark({n})")
    if reveal:
        reviewer._getTypedAnswer()  # Anki's own Show Answer path; ends in Reviewer._showAnswer()


def on_web_content(web_content: object, context: object) -> None:
    if not isinstance(context, Reviewer):
        return
    base = f"/_addons/{mw.addonManager.addonFromModule(__name__)}/web"
    web_content.css.append(f"{base}/howsure.css")
    web_content.js.append(f"{base}/howsure.js")


def on_question(card: Card) -> None:
    global _question_shown, _answer_shown, _pending
    _question_shown, _answer_shown, _pending = time.monotonic(), None, None
    cfg = config()
    lang_code = i18n.resolve(cfg["language"], anki.lang.current_lang)
    opts = {
        "buttons": cfg["show_buttons"],
        "title": i18n.t(lang_code, "bar_title"),
        "low": i18n.t(lang_code, "not_sure"),
        "high": i18n.t(lang_code, "certain"),
        "hints": [i18n.t(lang_code, "key_hint", key=k) for k in cfg["keys"]],
    }
    _eval(f"howsure.show({json.dumps(opts)})")


def on_answer_shown(card: Card) -> None:
    global _answer_shown
    _answer_shown = time.monotonic()
    _eval("howsure.hide()")


def on_js_message(handled: tuple[bool, object], message: str, context: object) -> tuple[bool, object]:
    if not (isinstance(context, Reviewer) and message.startswith("howsure:jol:")):
        return handled
    value = message[len("howsure:jol:"):]
    if value in ("1", "2", "3", "4", "5"):
        rate(int(value))
    return (True, None)


def _key_handler(n: int, original: Callable[[], None] | None) -> Callable[[], None]:
    def handler() -> None:
        if mw.reviewer.state == "question":
            rate(n)
        elif original is not None:
            original()
    return handler


def on_shortcuts(state: str, shortcuts: list[tuple[object, Callable]]) -> None:
    """Bind the rating keys on the review screen.

    Anki binds 1-4 (answer) and 5 (pause audio) as Qt shortcuts, and Qt consumes
    those key presses before the reviewer page sees them, so the keys cannot be
    read in JavaScript. On the question side our handler rates; everywhere else it
    calls whatever Anki had bound, so answer-side keys behave exactly as before.
    The hook API requires editing the list in place."""
    if state != "review":
        return
    for n, key in enumerate(config()["keys"][:5], start=1):
        hits = [i for i, (k, _) in enumerate(shortcuts) if k == key]
        for i in hits:
            shortcuts[i] = (key, _key_handler(n, shortcuts[i][1]))
        if not hits:
            shortcuts.append((key, _key_handler(n, None)))


def on_answer(reviewer: Reviewer, card: Card, ease: int) -> None:
    global _pending
    pending, _pending = _pending, None
    with db() as conn:
        if pending is None or pending["card_id"] != card.id:
            store.bump(conn, UNRATED)
            return
        salt = store.salt(conn)
        store.insert_rating(conn, {
            **{k: v for k, v in pending.items() if k != "card_id"},
            "ts": datetime.now(timezone.utc).isoformat(timespec="seconds"),
            "card_hash": store.hash_id(salt, card.id),
            "deck_hash": store.hash_id(salt, card.current_deck_id()),
            "notetype_hash": store.hash_id(salt, card.note().mid),
            "ease": ease,
            "a_rt_ms": _elapsed_ms(_answer_shown),
            "anki_version": ANKI_VERSION,
            "addon_version": ADDON_VERSION,
        })
