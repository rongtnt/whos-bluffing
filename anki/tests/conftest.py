import json
import sys
from pathlib import Path
from unittest import mock

import pytest

ANKI = Path(__file__).resolve().parents[1]
# src/howsure: import store/metrics/i18n as plain modules without running the
# package __init__ (which needs a running Anki). src: the package itself, for the
# import smoke test with a stubbed aqt.mw. scripts: make_deck.
for p in (ANKI / "src" / "howsure", ANKI / "src", ANKI / "scripts"):
    sys.path.insert(0, str(p))

SRC = ANKI / "src" / "howsure"
CONFIG = json.loads((SRC / "config.json").read_text(encoding="utf-8"))
HOOKS = ("webview_will_set_content", "state_shortcuts_will_change", "reviewer_did_show_question",
         "reviewer_did_show_answer", "webview_did_receive_js_message", "reviewer_did_answer_card",
         "profile_did_open", "profile_will_close")


@pytest.fixture(scope="session")
def pkg():
    """The add-on package imported once with aqt.mw stubbed: no Qt event loop, no window."""
    import aqt
    from aqt import gui_hooks
    from aqt.reviewer import Reviewer

    stub = mock.MagicMock()
    stub.addonManager.getConfig.return_value = CONFIG
    stub.addonManager.addonFromModule.return_value = "howsure"
    stub.reviewer = mock.MagicMock(spec=Reviewer)
    stub.reviewer.web = mock.MagicMock()
    before = {h: getattr(gui_hooks, h).count() for h in HOOKS}
    with mock.patch.object(aqt, "mw", stub):
        import howsure
        import howsure.hooks  # noqa: F401  (the brief's smoke target)
    for h in HOOKS:
        assert getattr(gui_hooks, h).count() == before[h] + 1, h
    assert [c.args for c in stub.form.menuTools.addAction.call_args_list] == [
        ("HowSure: my calibration",), ("HowSure: share anonymous data…",)]
    stub.addonManager.setWebExports.assert_called_once()
    stub.addonManager.setConfigUpdatedAction.assert_called_once_with("howsure", howsure.sharing.on_config_saved)
    return howsure
