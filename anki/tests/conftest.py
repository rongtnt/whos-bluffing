import sys
from pathlib import Path

ANKI = Path(__file__).resolve().parents[1]
# src/howsure: import store/metrics/i18n as plain modules without running the
# package __init__ (which needs a running Anki). src: the package itself, for the
# import smoke test with a stubbed aqt.mw. scripts: make_deck.
for p in (ANKI / "src" / "howsure", ANKI / "src", ANKI / "scripts"):
    sys.path.insert(0, str(p))
