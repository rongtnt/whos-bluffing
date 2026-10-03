"""Opt-in sharing, the Qt side: the consent dialog, when uploads run, and the dashboard's status line and buttons.
Sharing is off by default. Config is read here on the main thread; the network work runs in upload.py on a
background thread with plain values passed in."""
import threading
from collections.abc import Callable
from datetime import datetime, timezone
from functools import partial

from aqt import mw
from aqt.qt import QHBoxLayout, QLabel, QMessageBox, QPushButton, QWidget
from aqt.utils import askUser, showInfo, showWarning

from . import hooks, i18n, upload

EVERY_MS = 6 * 3600 * 1000

_timer = None              # the 6-hour QTimer, made once per Anki session
_busy = False              # an upload is running
_stop = threading.Event()  # set by Stop sharing / Delete my data to end a running upload after its current batch


def sharing_on(cfg: dict) -> bool:
    """Both the switch and consent to the current text are needed, so editing share_data alone sends nothing."""
    return bool(cfg.get("share_data")) and cfg.get("consent_version") == upload.CONSENT_VERSION


def _api_base(cfg: dict) -> str:
    return cfg["api_base"].rstrip("/")


def _write_config(**changes: object) -> None:
    mw.addonManager.writeConfig(__name__, {**hooks.config(), **changes})


def maybe_upload() -> None:
    """Start a background upload if sharing is on and none is running. Never blocks the UI."""
    global _busy
    cfg = hooks.config()
    if _busy or not sharing_on(cfg):
        return
    _busy = True
    _stop.clear()
    base = _api_base(cfg)
    mw.taskman.run_in_background(
        lambda: upload.upload_pending(hooks.DB_PATH, base, hooks.ADDON_VERSION, _stop),
        _upload_done, uses_collection=False)


def _upload_done(future) -> None:
    global _busy
    _busy = False
    try:
        result = future.result()
    except Exception as e:  # noqa: BLE001 - a failed upload must never disturb reviewing; the next run retries
        print(f"HowSure: upload failed ({e!r})")
        return
    if result["gone"]:
        _write_config(share_data=False)
        showInfo(i18n.t(hooks.lang(), "share_gone"))


def on_profile_open() -> None:
    """Upload once when a profile opens, then every 6 hours (uploads need only the add-on's own database)."""
    global _timer
    if _timer is None:
        _timer = mw.progress.timer(EVERY_MS, maybe_upload, repeat=True, requiresCollection=False, parent=mw)
    maybe_upload()


def on_config_saved(cfg: dict) -> None:
    """The config editor saved: if sharing is now off there, a running upload ends after its current batch."""
    if not sharing_on(cfg):
        _stop.set()


def on_profile_close() -> None:
    """Quitting or switching profile ends a running upload after its current batch (instead of keeping Anki's
    process alive until a long first upload finishes); the next profile open resumes from the cursor."""
    _stop.set()


def consent_text(lang: str) -> str:
    return i18n.t(lang, "consent_body", fields=i18n.SHARED_FIELDS)


def show_consent() -> None:
    """Tools > HowSure: share anonymous data... Accept turns sharing on; Not now changes nothing."""
    lang = hooks.lang()
    t = partial(i18n.t, lang)
    box = QMessageBox(mw)
    box.setWindowTitle(t("consent_title"))  # macOS ignores message box titles, so it is the bold text as well
    box.setText(t("consent_title"))
    box.setInformativeText(consent_text(lang))
    accept = box.addButton(t("accept"), QMessageBox.ButtonRole.AcceptRole)
    box.setDefaultButton(box.addButton(t("not_now"), QMessageBox.ButtonRole.RejectRole))  # Enter must not consent
    box.exec()
    if box.clickedButton() is accept:
        accept_consent()


def accept_consent() -> None:
    with hooks.db() as conn:
        upload.new_id_if_deleted(conn)
    now = datetime.now(timezone.utc).isoformat(timespec="seconds")
    _write_config(share_data=True, consent_version=upload.CONSENT_VERSION, consent_at=now)
    maybe_upload()


def stop_sharing() -> None:
    _stop.set()
    _write_config(share_data=False)


def delete_my_data(parent: QWidget, done: Callable[[], None]) -> None:
    """Turn sharing off, then ask the server to delete this installation's rows and report the count.
    done() refreshes the dashboard afterwards."""
    t = partial(i18n.t, hooks.lang())
    if not askUser(t("delete_confirm"), parent=parent):
        return
    stop_sharing()
    base = _api_base(hooks.config())

    def finished(future) -> None:
        try:
            n = future.result()
        except Exception as e:  # noqa: BLE001 - shown to the user; the button stays so they can try again
            print(f"HowSure: delete failed ({e!r})")
            showWarning(t("delete_failed"), parent=mw)
        else:
            showInfo(t("deleted", n=f"{n:,}"), parent=mw)
        done()

    mw.taskman.run_in_background(
        lambda: upload.delete_remote(hooks.DB_PATH, base, hooks.ADDON_VERSION), finished, uses_collection=False)


def ago(seconds: float, lang: str) -> str:
    t = partial(i18n.t, lang)
    if seconds < 60:
        return t("just_now")
    if seconds < 3600:
        return t("min_ago", n=int(seconds // 60))
    if seconds < 86400:
        return t("h_ago", n=int(seconds // 3600))
    return t("d_ago", n=int(seconds // 86400))


def status_text(cfg: dict, st: dict, lang: str, now: datetime | None = None) -> str:
    """e.g. "Sharing on · 1,240 ratings uploaded · last 2 h ago". st comes from upload.status()."""
    t = partial(i18n.t, lang)
    n = f"{st['uploaded']:,}"
    if sharing_on(cfg):
        if not st["last_upload_at"]:
            return t("status_on_none")
        seconds = ((now or datetime.now(timezone.utc)) - datetime.fromisoformat(st["last_upload_at"])).total_seconds()
        return t("status_on", n=n, ago=ago(max(0.0, seconds), lang))
    return t("status_off_uploaded", n=n) if st["uploaded"] else t("status_off")


def status_row(lang: str) -> QWidget:
    """The dashboard's sharing line: status text, Stop sharing (while on), Delete my data (once consent was given,
    until the data is deleted)."""
    t = partial(i18n.t, lang)
    row = QWidget()
    label = QLabel()
    stop_btn = QPushButton(t("stop_sharing"))
    delete_btn = QPushButton(t("delete_data"))

    def refresh() -> None:
        cfg = hooks.config()
        with hooks.db() as conn:
            st = upload.status(conn)
        label.setText(status_text(cfg, st, lang))
        stop_btn.setVisible(sharing_on(cfg))
        delete_btn.setVisible(bool(cfg.get("consent_version")) and not st["deleted"])

    stop_btn.clicked.connect(lambda: (stop_sharing(), refresh()))
    delete_btn.clicked.connect(lambda: delete_my_data(row.window(), refresh))
    layout = QHBoxLayout(row)
    layout.setContentsMargins(0, 0, 0, 0)
    layout.addWidget(label)
    layout.addStretch()
    layout.addWidget(stop_btn)
    layout.addWidget(delete_btn)
    refresh()
    return row
