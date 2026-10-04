"""Import smoke test plus headless checks of the reviewer glue: aqt.mw is a stub, the
collection is a real temporary Anki collection, no Qt event loop, no GUI."""
import json
from pathlib import Path
from types import SimpleNamespace
from unittest import mock

import pytest
from anki.buildinfo import version as anki_version
from anki.collection import Collection
from anki.scheduler.v3 import CardAnswer

from conftest import CONFIG, SRC  # the `pkg` fixture (package imported with a stubbed aqt.mw) lives in conftest.py


def test_import_registers_hooks_and_menu(pkg):
    manifest = json.loads((SRC / "manifest.json").read_text(encoding="utf-8"))
    assert manifest["package"] == "whosbluffing"
    assert manifest["human_version"] == pkg.hooks.ADDON_VERSION


def test_web_assets_injected_into_reviewer_only(pkg):
    content = SimpleNamespace(css=[], js=[])
    pkg.hooks.on_web_content(content, pkg.hooks.mw.reviewer)
    assert content.js == ["/_addons/whosbluffing/web/whosbluffing.js"]
    assert content.css == ["/_addons/whosbluffing/web/whosbluffing.css"]
    other = SimpleNamespace(css=[], js=[])
    pkg.hooks.on_web_content(other, object())
    assert other.css == other.js == []


def _press_all(hooks, keys, state, calls):
    hooks.mw.reviewer.state = state
    for k in keys:
        keys[k]()


def test_answer_side_keys_untouched(pkg):
    """Anki binds 1-4 to answer and 5 to pause audio; those must still run on the answer side."""
    hooks, calls = pkg.hooks, []
    shortcuts = [(str(e), (lambda e=e: calls.append(f"ease{e}"))) for e in (1, 2, 3, 4)]
    shortcuts += [("5", lambda: calls.append("pause_audio")), (" ", lambda: calls.append("space"))]
    hooks.on_shortcuts("review", shortcuts)
    keys = dict(shortcuts)
    assert list(keys) == ["1", "2", "3", "4", "5", " "]
    with mock.patch.object(hooks, "rate", lambda n: calls.append(f"rate{n}")):
        _press_all(hooks, {k: keys[k] for k in "12345"}, "answer", calls)
        keys[" "]()
        _press_all(hooks, {k: keys[k] for k in "12345"}, "question", calls)
    assert calls == ["ease1", "ease2", "ease3", "ease4", "pause_audio", "space",
                     "rate1", "rate2", "rate3", "rate4", "rate5"]


def test_unbound_keys_added_question_side_only(pkg):
    """Answer keys remapped (e.g. to j): 1-5 are added and do nothing on the answer side."""
    hooks, calls = pkg.hooks, []
    shortcuts = [("j", lambda: calls.append("ease1"))]
    hooks.on_shortcuts("review", shortcuts)
    keys = dict(shortcuts)
    with mock.patch.object(hooks, "rate", lambda n: calls.append(f"rate{n}")):
        _press_all(hooks, {k: keys[k] for k in "12345"}, "answer", calls)
        keys["j"]()
        hooks.mw.reviewer.state = "question"
        keys["3"]()
    assert calls == ["ease1", "rate3"]


def test_other_screens_untouched(pkg):
    shortcuts = [("1", print)]
    pkg.hooks.on_shortcuts("overview", shortcuts)
    assert shortcuts == [("1", print)]


def test_js_message_filter(pkg):
    hooks, rv = pkg.hooks, pkg.hooks.mw.reviewer
    assert hooks.on_js_message((False, None), "ans", rv) == (False, None)
    assert hooks.on_js_message((False, None), "whosbluffing:jol:3", object()) == (False, None)
    with mock.patch.object(hooks, "rate") as rate:
        assert hooks.on_js_message((False, None), "whosbluffing:jol:9", rv) == (True, None)
        assert hooks.on_js_message((False, None), "whosbluffing:jol:x", rv) == (True, None)
        rate.assert_not_called()
        hooks.on_js_message((False, None), "whosbluffing:jol:5", rv)
        rate.assert_called_once_with(5)


# Full flow against a real temporary collection.

@pytest.fixture
def env(pkg, tmp_path, monkeypatch):
    col = Collection(str(tmp_path / "collection.anki2"))
    hooks = pkg.hooks
    monkeypatch.setattr(hooks, "DB_PATH", str(tmp_path / "user_files" / "whosbluffing.sqlite"))
    monkeypatch.setattr(hooks.mw, "col", col)
    hooks.mw.reviewer.reset_mock()
    yield hooks, col, hooks.mw.reviewer
    col.close()


def add_card(col, front="SECRET-FRONT"):
    note = col.new_note(col.models.by_name("Basic"))
    note["Front"], note["Back"] = front, "SECRET-BACK"
    col.add_note(note, col.decks.id("Spanish"))
    return note.cards()[0]


def review_once(col, card):
    """One real Good review with FSRS on, so the card has a revlog row and memory state."""
    col.set_config("fsrs", True)
    col.decks.select(card.did)
    queued = col.sched.get_queued_cards().cards[0]
    target = col.get_card(queued.card.id)
    target.start_timer()
    col.sched.answer_card(col.sched.build_answer(card=target, states=queued.states, rating=CardAnswer.GOOD))
    card.load()


def show_question(hooks, rv, card):
    rv.state, rv.card = "question", card
    hooks.on_question(card)


def show_answer_and_grade(hooks, rv, card, ease):
    rv.state = "answer"
    hooks.on_answer_shown(card)
    hooks.on_answer(rv, card, ease)


def saved(hooks):
    with hooks.db() as conn:
        return hooks.store.rows(conn), hooks.store.counter(conn, hooks.UNRATED), hooks.store.salt(conn)


def test_rate_reveal_answer_writes_one_row(env):
    hooks, col, rv = env
    card = add_card(col)
    review_once(col, card)
    show_question(hooks, rv, card)
    assert "whosbluffing.show(" in rv.web.eval.call_args.args[0]
    assert hooks.on_js_message((False, None), "whosbluffing:jol:4", rv) == (True, None)
    rv._getTypedAnswer.assert_called_once()  # reveal_on_rate: one press records and reveals
    hooks.rate(2)  # second press while the answer is coming: ignored
    show_answer_and_grade(hooks, rv, card, 3)
    rows, unrated, salt = saved(hooks)
    assert unrated == 0 and len(rows) == 1
    row = rows[0]
    assert (row["jol"], row["ease"]) == (4, 3)
    assert row["card_hash"] == hooks.store.hash_id(salt, card.id)
    assert row["deck_hash"] == hooks.store.hash_id(salt, card.current_deck_id())
    assert row["notetype_hash"] == hooks.store.hash_id(salt, card.note().mid)
    # pre-answer state: one earlier review, FSRS memory present, retrievability below/at 1
    assert row["reps"] == 1 and row["days_since_last_review"] >= 0
    assert row["stability"] > 0 and row["difficulty"] > 0 and 0 < row["retrievability"] <= 1
    assert row["q_rt_ms"] >= 0 and row["a_rt_ms"] >= 0
    assert (row["anki_version"], row["addon_version"]) == (anki_version, hooks.ADDON_VERSION)
    assert row["ts"].endswith("+00:00")
    raw = b"".join(p.read_bytes() for p in Path(hooks.DB_PATH).parent.iterdir())
    assert b"SECRET" not in raw  # never card content


def test_reveal_off_only_records_and_new_card_nulls(env, monkeypatch):
    hooks, col, rv = env
    monkeypatch.setattr(hooks.mw.addonManager.getConfig, "return_value", {**CONFIG, "reveal_on_rate": False})
    card = add_card(col)
    show_question(hooks, rv, card)
    hooks.rate(2)
    hooks.rate(5)  # change of mind before revealing: last press wins
    rv._getTypedAnswer.assert_not_called()
    show_answer_and_grade(hooks, rv, card, 1)
    (row,), unrated, _ = saved(hooks)
    assert (row["jol"], row["ease"], row["reps"], row["ivl_days"]) == (5, 1, 0, 0)
    assert row["days_since_last_review"] is None and row["stability"] is None
    assert row["difficulty"] is None and row["retrievability"] is None


def test_answers_without_rating_only_count(env):
    hooks, col, rv = env
    first, second = add_card(col, "A"), add_card(col, "B")
    show_question(hooks, rv, first)
    show_answer_and_grade(hooks, rv, first, 3)  # no rating at all
    show_question(hooks, rv, second)
    hooks.on_js_message((False, None), "whosbluffing:jol:3", rv)
    show_question(hooks, rv, first)  # next question drops the stale rating
    show_answer_and_grade(hooks, rv, first, 2)
    rows, unrated, _ = saved(hooks)
    assert rows == [] and unrated == 2


def test_dashboard_render(pkg):
    dash = pkg.dashboard
    assert "1–5" in dash.render([], 0, {}, "en")
    rows = [{"jol": 5, "ease": 1, "deck_hash": "h1", "ts": "2026-10-02T12:00:00+00:00"},
            {"jol": 2, "ease": 3, "deck_hash": "h2", "ts": "2026-10-03T12:00:00+00:00"}]
    page = dash.render(rows, 7, {"h1": "<b>Bio</b>"}, "zh")
    assert page.count("<svg") == 2 and "&lt;b&gt;Bio&lt;/b&gt;" in page
    assert "已删除的牌组 h2" in page and "未评分作答 7 次" in page
    assert "http" not in page.lower()
