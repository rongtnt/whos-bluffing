"""HowSure: press 1-5 on the question side to say how sure you are. Local only."""
from aqt import gui_hooks, mw

from . import dashboard, hooks, i18n

mw.addonManager.setWebExports(__name__, r"web/.*\.(css|js)")

gui_hooks.webview_will_set_content.append(hooks.on_web_content)
gui_hooks.state_shortcuts_will_change.append(hooks.on_shortcuts)
gui_hooks.reviewer_did_show_question.append(hooks.on_question)
gui_hooks.reviewer_did_show_answer.append(hooks.on_answer_shown)
gui_hooks.webview_did_receive_js_message.append(hooks.on_js_message)
gui_hooks.reviewer_did_answer_card.append(hooks.on_answer)

_action = mw.form.menuTools.addAction(i18n.t(hooks.lang(), "menu"))
_action.triggered.connect(dashboard.show)
