"""Build the public Who's Bluffing calibration decks (en, zh) from the two-alternative items
in items/items.json. Dev-only (needs genanki).

    uv run --project anki python anki/scripts/make_deck.py

Writes anki/dist/WhosBluffing-Calibration-Deck-en.apkg and -zh.apkg. If the bank is
missing or has no two-alternative items, prints a skip message and writes nothing."""
import html
import json
from pathlib import Path

import genanki

ROOT = Path(__file__).resolve().parents[2]
ITEMS = ROOT / "items" / "items.json"
OUT = ROOT / "anki" / "dist"
LANGS = ("en", "zh")
LETTERS = "AB"
# Fixed ids, so re-importing a newer deck updates notes instead of duplicating them.
MODEL_ID = 1745312601
DECK_IDS = {"en": 1745312611, "zh": 1745312612}
DECK_NAMES = {"en": "Who's Bluffing? Calibration Deck", "zh": "Who's Bluffing? 校准题库"}

MODEL = genanki.Model(
    MODEL_ID,
    "Who's Bluffing? two-choice",
    fields=[{"name": f} for f in ("ID", "Prompt", "OptionA", "OptionB", "Answer", "Source")],
    templates=[{
        "name": "Card 1",
        "qfmt": '<div class="prompt">{{Prompt}}</div>'
                '<ol type="A" class="options"><li>{{OptionA}}</li><li>{{OptionB}}</li></ol>',
        "afmt": '{{FrontSide}}<hr id="answer"><div class="answer">{{Answer}}</div>'
                '<div class="source">{{Source}}</div>',
    }],
    css=".card { font-family: sans-serif; font-size: 20px; text-align: center; }"
        ".options { display: inline-block; text-align: left; }"
        ".answer { font-weight: bold; }"
        ".source { font-size: 14px; opacity: .7; margin-top: 1em; }",
)


def load_items(path: str | Path) -> list[dict]:
    """Two-alternative items from the bank; [] when the file is missing or empty."""
    path = Path(path)
    if not path.exists() or not path.read_text(encoding="utf-8").strip():
        return []
    items = [it for it in json.loads(path.read_text(encoding="utf-8")).get("items", [])
             if it.get("type") == "2afc"]
    for it in items:
        for lang in LANGS:
            if len(it[lang].get("options", [])) != 2 or it["answer"] not in (0, 1):
                raise ValueError(f"item {it['id']}: needs two {lang} options and answer 0 or 1")
    return items


def note(item: dict, lang: str) -> genanki.Note:
    text, answer = item[lang], int(item["answer"])
    esc = html.escape
    return genanki.Note(
        model=MODEL,
        fields=[item["id"], esc(text["prompt"]), esc(text["options"][0]), esc(text["options"][1]),
                f"{LETTERS[answer]}. {esc(text['options'][answer])}", esc(item["source"])],
        tags=["whosbluffing::public", f"whosbluffing::{item['id']}"],
        guid=genanki.guid_for("whosbluffing", item["id"], lang),
    )


def build(items_path: str | Path = ITEMS, out_dir: str | Path = OUT) -> dict[str, tuple[Path, int]]:
    """Returns {lang: (apkg path, note count)}; {} when there is nothing to build."""
    items = load_items(items_path)
    if not items:
        print(f"skipped: no two-alternative items in {items_path} (bank missing or empty)")
        return {}
    out_dir = Path(out_dir)
    out_dir.mkdir(parents=True, exist_ok=True)
    built = {}
    for lang in LANGS:
        deck = genanki.Deck(DECK_IDS[lang], DECK_NAMES[lang])
        for item in items:
            deck.add_note(note(item, lang))
        path = out_dir / f"WhosBluffing-Calibration-Deck-{lang}.apkg"
        genanki.Package(deck).write_to_file(str(path))
        built[lang] = (path, len(items))
    return built


if __name__ == "__main__":
    for lang, (path, n) in build().items():
        print(f"{lang}: {n} notes -> {path}")
