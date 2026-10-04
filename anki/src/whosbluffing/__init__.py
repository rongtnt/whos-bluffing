"""Who's Bluffing: press 1-5 on the question side to say how sure you are. Ratings stay on this computer unless the
user turns on anonymous sharing (off by default)."""
from aqt import gui_hooks, mw

from . import dashboard, hooks, i18n, sharing

mw.addonManager.setWebExports(__name__, r"web/.*\.(css|js)")

gui_hooks.webview_will_set_content.append(hooks.on_web_content)
gui_hooks.state_shortcuts_will_change.append(hooks.on_shortcuts)
gui_hooks.reviewer_did_show_question.append(hooks.on_question)
gui_hooks.reviewer_did_show_answer.append(hooks.on_answer_shown)
gui_hooks.webview_did_receive_js_message.append(hooks.on_js_message)
gui_hooks.reviewer_did_answer_card.append(hooks.on_answer)
gui_hooks.profile_did_open.append(sharing.on_profile_open)
gui_hooks.profile_will_close.append(sharing.on_profile_close)
mw.addonManager.setConfigUpdatedAction(__name__, sharing.on_config_saved)

_action = mw.form.menuTools.addAction(i18n.t(hooks.lang(), "menu"))
_action.triggered.connect(dashboard.show)
_share = mw.form.menuTools.addAction(i18n.t(hooks.lang(), "share_menu"))
_share.triggered.connect(sharing.show_consent)
