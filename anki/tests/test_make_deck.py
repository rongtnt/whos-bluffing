import json
import sqlite3
import zipfile
from contextlib import closing

import pytest

import make_deck


def item(item_id, kind="2afc", answer=1):
    return {"id": item_id, "type": kind, "domain": "everyday",
            "en": {"prompt": f"Placeholder prompt {item_id} <x>?", "options": ["Option one", "Option two"]},
            "zh": {"prompt": f"占位题 {item_id}？", "options": ["选项一", "选项二"]},
            "answer": answer, "source": "test fixture", "difficulty_hint": "easy"}


def read_apkg(path, tmp_path):
    """(note count, tags, deck JSON, model JSON) from the collection inside an .apkg."""
    db = tmp_path / f"{path.stem}.anki2"
    with zipfile.ZipFile(path) as z:
        db.write_bytes(z.read("collection.anki2"))
    with closing(sqlite3.connect(db)) as conn:
        n = conn.execute("SELECT count(*) FROM notes").fetchone()[0]
        tags = [t for (t,) in conn.execute("SELECT tags FROM notes")]
        decks, models = conn.execute("SELECT decks, models FROM col").fetchone()
    return n, tags, decks, models


def test_builds_two_decks_from_two_choice_items(tmp_path):
    interval = {**item("x003", kind="interval", answer=42), "accept": [0, 100]}
    bank = tmp_path / "items.json"
    bank.write_text(json.dumps({"version": 1, "items": [item("x001"), item("x002", answer=0), interval]},
                               ensure_ascii=False), encoding="utf-8")
    built = make_deck.build(bank, tmp_path / "dist")
    assert set(built) == {"en", "zh"}
    for lang, (path, count) in built.items():
        assert path.name == f"WhosBluffing-Calibration-Deck-{lang}.apkg"
        n, tags, decks, models = read_apkg(path, tmp_path)
        assert n == count == 2  # the interval item is not a two-alternative item
        assert all("whosbluffing::public" in t for t in tags)
        assert any("whosbluffing::x001" in t for t in tags)
        assert str(make_deck.DECK_IDS[lang]) in decks and str(make_deck.MODEL_ID) in models


def test_missing_or_empty_bank_is_a_clear_skip(tmp_path, capsys):
    empty = tmp_path / "empty.json"
    empty.write_text("", encoding="utf-8")
    no_items = tmp_path / "no_items.json"
    no_items.write_text('{"version": 1, "items": []}', encoding="utf-8")
    for bank in (tmp_path / "missing.json", empty, no_items):
        assert make_deck.build(bank, tmp_path / "dist") == {}
    assert capsys.readouterr().out.count("skipped") == 3
    assert not (tmp_path / "dist").exists()


def test_malformed_two_choice_item_fails_loudly(tmp_path):
    bad = item("x009")
    bad["zh"]["options"] = ["only one"]
    bank = tmp_path / "items.json"
    bank.write_text(json.dumps({"version": 1, "items": [bad]}), encoding="utf-8")
    with pytest.raises(ValueError, match="x009"):
        make_deck.build(bank, tmp_path / "dist")


def test_real_bank(tmp_path):
    items = make_deck.load_items(make_deck.ITEMS)
    if not items:
        pytest.skip(f"{make_deck.ITEMS} missing or has no two-alternative items yet (drafted in parallel)")
    for path, count in make_deck.build(make_deck.ITEMS, tmp_path).values():
        assert read_apkg(path, tmp_path)[0] == count == len(items)
