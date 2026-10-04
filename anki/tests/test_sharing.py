"""Opt-in sharing (v0.2), headless: aqt.mw is the stub from conftest, urlopen is mocked, background tasks run
inline. Nothing here touches the network or opens a window."""
import io
import json
import re
import urllib.error
from concurrent.futures import Future
from contextlib import closing
from datetime import datetime, timezone
from unittest import mock

import pytest

from conftest import ANKI, CONFIG

PRIVACY = (ANKI.parent / "PRIVACY.md").read_text(encoding="utf-8")
SERVER_INSTALL_RE = re.compile(r"^[A-Za-z0-9_-]{32,64}$")  # what web/functions/_anki.js accepts
BASE = "https://whosbluffing.example"


def full_row(store, salt, n):
    """A local row with every column set, including the ones that must never be sent."""
    return {
        "ts": "2026-10-03T12:00:00+00:00", "card_hash": store.hash_id(salt, 1_700_000_000_000 + n),
        "deck_hash": store.hash_id(salt, 1), "notetype_hash": store.hash_id(salt, 2), "jol": 1 + n % 5,
        "ease": 1 + n % 4, "q_rt_ms": 1500, "a_rt_ms": 800, "ivl_days": 12, "reps": 5, "lapses": 1,
        "days_since_last_review": 11.5, "stability": 14.25, "difficulty": 5.5, "retrievability": 0.9,
        "anki_version": "26.09.3", "addon_version": "0.2.0",
    }


@pytest.fixture
def env(pkg, tmp_path, monkeypatch):
    """A temp database, a config that remembers writes, inline background tasks, and no network."""
    hooks, sharing, upload = pkg.hooks, pkg.sharing, pkg.upload
    monkeypatch.setattr(hooks, "DB_PATH", str(tmp_path / "user_files" / "whosbluffing.sqlite"))
    state = {**CONFIG, "api_base": BASE}
    manager = hooks.mw.addonManager
    monkeypatch.setattr(manager.getConfig, "side_effect", lambda _module: dict(state))
    monkeypatch.setattr(manager.writeConfig, "side_effect", lambda _module, new: (state.clear(), state.update(new)))

    def run_now(task, on_done=None, uses_collection=True):
        future = Future()
        try:
            future.set_result(task())
        except Exception as e:  # noqa: BLE001 - delivered through the future, like the real task manager
            future.set_exception(e)
        if on_done:
            on_done(future)
        return future

    background = mock.Mock(side_effect=run_now)
    monkeypatch.setattr(hooks.mw.taskman, "run_in_background", background)
    urlopen = mock.Mock(side_effect=AssertionError("unexpected network call"))
    monkeypatch.setattr(upload.urllib.request, "urlopen", urlopen)
    for name in ("askUser", "showInfo", "showWarning"):
        monkeypatch.setattr(sharing, name, mock.Mock(return_value=True))
    monkeypatch.setattr(sharing, "_busy", False)
    monkeypatch.setattr(sharing, "_timer", None)
    sharing._stop.clear()
    return pkg, state, background, urlopen


def add_rows(pkg, n):
    store = pkg.store
    with closing(store.connect(pkg.hooks.DB_PATH)) as conn:
        salt = store.salt(conn)
        for i in range(n):
            store.insert_rating(conn, full_row(store, salt, i))


def reply(body):
    return io.BytesIO(json.dumps(body).encode())


def sent_bodies(urlopen):
    return [json.loads(c.args[0].data) for c in urlopen.call_args_list]


def local(pkg):
    with closing(pkg.store.connect(pkg.hooks.DB_PATH)) as conn:
        return pkg.upload.status(conn), pkg.upload.install_id(conn), pkg.store.salt(conn)


def consented(state):
    state.update(share_data=True, consent_version="1", consent_at="2026-10-03T12:00:00+00:00")


def test_consent_text_quotes_the_privacy_field_list(pkg):
    """The consent dialog (en and zh) shows PRIVACY.md's Anki field list word for word."""
    section = PRIVACY.split("## Anki add-on", 1)[1]
    sentence = re.search(r"If you turn it on, the add-on sends: ([^.]+)\.", section)
    assert sentence, "PRIVACY.md lost its Anki field list"
    assert pkg.i18n.SHARED_FIELDS == sentence.group(1)
    for lang in ("en", "zh"):
        assert sentence.group(0) in pkg.sharing.consent_text(lang)
    assert pkg.upload.CONSENT_VERSION == "1"


def test_payload_keeps_only_whitelisted_fields(env):
    pkg, *_ = env
    upload, store = pkg.upload, pkg.store
    add_rows(pkg, 2)
    with closing(store.connect(pkg.hooks.DB_PATH)) as conn:
        rows, install, salt = upload.pending(conn), upload.install_id(conn), store.salt(conn)
    assert set(upload.SHARED_COLUMNS) < set(store.COLUMNS)
    body = upload.payload(install, [{**rows[0], "front": "SECRET card text", "card_id": 1_700_000_000_000}, rows[1]], "0.2.0")
    assert set(body) == {"install_id", "addon_version", "consent_version", "rows"}
    assert [set(r) for r in body["rows"]] == [{"row_id", *upload.SHARED_COLUMNS}] * 2
    for never in ("ts", "notetype_hash", "reps", "lapses", "front", "card_id", "id"):
        assert never not in body["rows"][0]
    assert [r["row_id"] for r in body["rows"]] == [1, 2]
    assert body["rows"][0]["card_hash"] == store.hash_id(salt, 1_700_000_000_000)  # a salted hash, never the id
    raw = json.dumps(body)
    assert "SECRET" not in raw and "1700000000000" not in raw and salt not in raw
    # The installation id is the salt hashed again: stable, not the salt, and in the server's format.
    assert install == store.hash_id(salt, "install-0") != salt
    assert SERVER_INSTALL_RE.match(install)
    assert (body["consent_version"], body["addon_version"]) == ("1", "0.2.0")


def test_cursor_advances_only_after_the_server_accepts(env, monkeypatch):
    pkg, _, _, urlopen = env
    upload = pkg.upload
    monkeypatch.setattr(upload, "BATCH", 2)
    add_rows(pkg, 3)
    run = lambda: upload.upload_pending(pkg.hooks.DB_PATH, BASE, "0.2.0", pkg.sharing._stop)  # noqa: E731

    urlopen.side_effect = urllib.error.URLError("offline")
    assert run() == {"sent": 0, "gone": False}
    assert local(pkg)[0] == {"uploaded": 0, "last_upload_at": None, "deleted": False}

    urlopen.side_effect = [reply({"accepted": 2}), TimeoutError("slow")]  # batch 1 ok, batch 2 times out
    assert run() == {"sent": 2, "gone": False}
    assert local(pkg)[0]["uploaded"] == 2

    urlopen.side_effect = [reply({"accepted": 1})]
    assert run() == {"sent": 1, "gone": False}
    status = local(pkg)[0]
    assert status["uploaded"] == 3 and status["last_upload_at"].endswith("+00:00")
    assert [[r["row_id"] for r in b["rows"]] for b in sent_bodies(urlopen)] == [[1, 2], [1, 2], [3], [3]]
    request = urlopen.call_args.args[0]
    assert (request.full_url, request.get_method()) == (f"{BASE}/api/anki/submit", "POST")
    assert request.get_header("Content-type") == "application/json"
    assert urlopen.call_args.kwargs == {"timeout": upload.TIMEOUT_S}

    calls = urlopen.call_count
    assert run() == {"sent": 0, "gone": False}  # nothing new: no request at all
    assert urlopen.call_count == calls


def test_server_error_keeps_the_cursor(env):
    pkg, _, _, urlopen = env
    add_rows(pkg, 1)
    urlopen.side_effect = urllib.error.HTTPError(f"{BASE}/api/anki/submit", 500, "server error", {}, None)
    assert pkg.upload.upload_pending(pkg.hooks.DB_PATH, BASE, "0.2.0", pkg.sharing._stop) == {"sent": 0, "gone": False}
    assert local(pkg)[0]["uploaded"] == 0


def test_closing_the_profile_ends_an_upload_before_the_next_batch(env):
    pkg, _, _, urlopen = env
    add_rows(pkg, 1)
    pkg.sharing.on_profile_close()  # Anki quitting or switching profile (Stop sharing sets the same event)
    assert pkg.upload.upload_pending(pkg.hooks.DB_PATH, BASE, "0.2.0", pkg.sharing._stop) == {"sent": 0, "gone": False}
    urlopen.assert_not_called()


def test_switching_sharing_off_in_the_config_editor_stops_a_running_upload(env):
    pkg, *_ = env
    sharing = pkg.sharing
    sharing.on_config_saved({**CONFIG, "share_data": True, "consent_version": "1"})
    assert not sharing._stop.is_set()
    sharing.on_config_saved({**CONFIG, "share_data": False, "consent_version": "1"})
    assert sharing._stop.is_set()


def test_accept_during_a_running_delete_ends_with_sharing_off(env):
    """Accept pressed before a running Delete finished: the id is deleted while sharing is on. The next upload
    reports it like a 410 (sharing off, one message), so the following Accept moves to a new id."""
    pkg, state, background, urlopen = env
    add_rows(pkg, 1)
    consented(state)
    with closing(pkg.store.connect(pkg.hooks.DB_PATH)) as conn:
        pkg.upload.forget(conn)  # what the finishing delete does
    pkg.sharing.maybe_upload()
    urlopen.assert_not_called()
    assert state["share_data"] is False
    pkg.sharing.showInfo.assert_called_once_with(pkg.i18n.t("en", "share_gone"))


def test_no_upload_unless_sharing_is_on_and_consented(env):
    pkg, state, background, urlopen = env
    sharing = pkg.sharing
    add_rows(pkg, 1)
    for change in ({"share_data": False, "consent_version": "1"},   # consented earlier, then stopped
                   {"share_data": True, "consent_version": ""},     # switched on in the config editor, no consent
                   {"share_data": True, "consent_version": "0"}):   # consent to an older text
        state.update(change)
        sharing.maybe_upload()
        sharing.on_profile_open()
    background.assert_not_called()
    urlopen.assert_not_called()
    assert local(pkg)[0]["uploaded"] == 0

    state.update(share_data=True, consent_version="1")
    urlopen.side_effect = [reply({"accepted": 1})]
    sharing.maybe_upload()
    assert background.call_count == 1 and background.call_args.kwargs == {"uses_collection": False}
    assert local(pkg)[0]["uploaded"] == 1


def test_profile_open_uploads_and_starts_one_six_hour_timer(env):
    pkg, state, background, urlopen = env
    sharing, mw = pkg.sharing, pkg.hooks.mw
    mw.progress.timer.reset_mock()
    consented(state)
    sharing.on_profile_open()
    sharing.on_profile_open()  # switching profiles must not add a second timer
    mw.progress.timer.assert_called_once_with(6 * 3600 * 1000, sharing.maybe_upload, repeat=True,
                                              requiresCollection=False, parent=mw)
    assert background.call_count == 2  # one upload attempt per profile open (nothing to send here)
    urlopen.assert_not_called()


def test_410_turns_sharing_off_once_and_the_next_consent_uses_a_new_id(env):
    pkg, state, background, urlopen = env
    sharing = pkg.sharing
    add_rows(pkg, 2)
    consented(state)
    _, first_id, _ = local(pkg)
    urlopen.side_effect = urllib.error.HTTPError(f"{BASE}/api/anki/submit", 410, "Gone", {}, None)
    sharing.maybe_upload()
    assert state["share_data"] is False
    sharing.showInfo.assert_called_once_with(pkg.i18n.t("en", "share_gone"))
    assert local(pkg)[0] == {"uploaded": 0, "last_upload_at": None, "deleted": True}
    sharing.maybe_upload()  # sharing is off now: no second message, no request
    assert sharing.showInfo.call_count == 1 and urlopen.call_count == 1

    urlopen.side_effect = [reply({"accepted": 2})]
    sharing.accept_consent()
    status, second_id, _ = local(pkg)
    assert second_id != first_id and SERVER_INSTALL_RE.match(second_id)
    assert status["uploaded"] == 2 and not status["deleted"]
    assert sent_bodies(urlopen)[-1]["install_id"] == second_id


def test_accept_records_consent_and_starts_uploading(env):
    pkg, state, background, urlopen = env
    add_rows(pkg, 1)
    urlopen.side_effect = [reply({"accepted": 1})]
    pkg.sharing.accept_consent()
    assert state["share_data"] is True and state["consent_version"] == pkg.upload.CONSENT_VERSION
    assert datetime.fromisoformat(state["consent_at"]).tzinfo is not None
    assert local(pkg)[0]["uploaded"] == 1


def test_delete_clears_the_cursor_and_turns_sharing_off(env):
    pkg, state, background, urlopen = env
    sharing = pkg.sharing
    add_rows(pkg, 3)
    consented(state)
    urlopen.side_effect = [reply({"accepted": 3})]
    sharing.maybe_upload()
    _, install, _ = local(pkg)
    done = mock.Mock()

    sharing.askUser.return_value = False  # the user cancels: nothing happens
    sharing.delete_my_data(None, done)
    assert state["share_data"] is True and urlopen.call_count == 1 and not done.called

    sharing.askUser.return_value = True
    urlopen.side_effect = urllib.error.URLError("offline")  # unreachable: sharing off, data kept, told to retry
    sharing.delete_my_data(None, done)
    assert state["share_data"] is False
    sharing.showWarning.assert_called_once()
    assert local(pkg)[0]["uploaded"] == 3 and not local(pkg)[0]["deleted"]

    urlopen.side_effect = [reply({"deleted_rows": 3})]
    sharing.delete_my_data(None, done)
    request = urlopen.call_args.args[0]
    assert request.full_url == f"{BASE}/api/anki/delete" and json.loads(request.data) == {"install_id": install}
    sharing.showInfo.assert_called_with(pkg.i18n.t("en", "deleted", n="3"), parent=pkg.hooks.mw)
    assert local(pkg)[0] == {"uploaded": 0, "last_upload_at": None, "deleted": True}
    assert state["share_data"] is False and done.call_count == 2


def test_status_line(pkg):
    sharing = pkg.sharing
    on = {**CONFIG, "share_data": True, "consent_version": "1"}
    now = datetime(2026, 10, 3, 12, 0, tzinfo=timezone.utc)
    st = {"uploaded": 1240, "last_upload_at": "2026-10-03T10:00:00+00:00", "deleted": False}
    assert sharing.status_text(on, st, "en", now) == "Sharing on · 1,240 ratings uploaded · last 2 h ago"
    assert sharing.status_text(on, st, "zh", now) == "分享已开启 · 已上传 1,240 条评分 · 上次 2 小时前"
    assert sharing.status_text(on, {**st, "uploaded": 0, "last_upload_at": None}, "en", now) == "Sharing on · nothing uploaded yet"
    assert sharing.status_text(CONFIG, st, "en", now) == "Sharing off · 1,240 ratings uploaded earlier"
    assert sharing.status_text(CONFIG, {**st, "uploaded": 0}, "en", now) == "Sharing off"
    assert [sharing.ago(s, "en") for s in (5, 600, 7200, 3 * 86400)] == ["just now", "10 min ago", "2 h ago", "3 d ago"]
