"""Opt-in sharing, the network side. The only module that sends anything (stdlib urllib). It runs in a
background thread and never touches Qt or the collection; sharing.py decides when it may run and passes in
plain values. It sends only the fields that PRIVACY.md lists."""
import json
import threading
import urllib.error
import urllib.request
from contextlib import closing
from datetime import datetime, timezone

from . import store

# Bump when the shared fields or the consent text change: consent to an older text then no longer counts.
CONSENT_VERSION = "1"
BATCH = 500
TIMEOUT_S = 30
CURSOR, GENERATION, DELETED, LAST_UPLOAD = "upload_cursor", "share_generation", "share_deleted", "last_upload_at"

# PRIVACY.md ("Anki add-on" section) item -> the local columns that carry it. Nothing else leaves the computer.
# Not listed there, so never sent: ts, notetype_hash, reps, lapses. "interface language" is listed, but the server
# has no column for it, so it is not sent either. Each row also carries row_id, its local sequence number, so an
# interrupted upload resumes without duplicates.
SHARED_COLUMNS = (
    "card_hash", "deck_hash",                     # hashed card and deck identifiers (never card text)
    "jol",                                        # your rating
    "ease",                                       # the grade you gave
    "q_rt_ms", "a_rt_ms",                         # response times
    "ivl_days",                                   # the scheduled interval
    "days_since_last_review",                     # days since last review
    "stability", "difficulty", "retrievability",  # FSRS memory state when available
    "anki_version", "addon_version",              # add-on and Anki versions
)
PAYLOAD_ROW_KEYS = ("row_id", *SHARED_COLUMNS)

_lock = threading.Lock()  # one network job at a time: an upload and a delete never overlap


class Gone(Exception):
    """The server deleted this installation id's data (HTTP 410)."""


def install_id(conn) -> str:
    """The local salt hashed again with the sharing generation: the salt never leaves the computer, and after a
    deletion a new id is used (the server refuses a deleted id for good)."""
    return store.hash_id(store.salt(conn), f"install-{store.counter(conn, GENERATION)}")


def pending(conn, limit: int | None = None) -> list[dict]:
    """Local rows after the upload cursor, oldest first."""
    sql = f"SELECT id AS row_id, {', '.join(store.COLUMNS)} FROM ratings WHERE id > ? ORDER BY id LIMIT ?"
    return [dict(r) for r in conn.execute(sql, (store.counter(conn, CURSOR), limit or BATCH))]


def payload(install: str, rows: list[dict], addon_version: str) -> dict:
    """The request body. Each row keeps only PAYLOAD_ROW_KEYS, whatever else it holds."""
    return {
        "install_id": install,
        "addon_version": addon_version,
        "consent_version": CONSENT_VERSION,
        "rows": [{k: r[k] for k in PAYLOAD_ROW_KEYS} for r in rows],
    }


def post(url: str, body: dict, addon_version: str) -> dict:
    request = urllib.request.Request(
        url, data=json.dumps(body).encode(), method="POST",
        headers={"Content-Type": "application/json", "User-Agent": f"HowSure-Anki/{addon_version}"})
    try:
        with urllib.request.urlopen(request, timeout=TIMEOUT_S) as response:
            return json.load(response)
    except urllib.error.HTTPError as e:
        if e.code == 410:
            raise Gone() from e
        raise


def forget(conn) -> None:
    """The server has deleted this id: start again from row 1 under a new id if sharing is turned on again."""
    store.set_meta(conn, DELETED, 1)
    store.set_meta(conn, CURSOR, 0)
    store.set_meta(conn, LAST_UPLOAD, "")


def new_id_if_deleted(conn) -> None:
    """Called when the user accepts: a deleted id is never reused."""
    if store.counter(conn, DELETED):
        store.set_meta(conn, GENERATION, store.counter(conn, GENERATION) + 1)
        store.set_meta(conn, DELETED, 0)


def upload_pending(db_path: str, api_base: str, addon_version: str, stop: threading.Event) -> dict:
    """Send every row after the cursor, BATCH at a time; the cursor moves only after the server accepted a batch.
    A network or server error ends the run quietly (the next run retries the same rows); 410 forgets the id.
    Returns {"sent": rows accepted this run, "gone": True if the server refused the id}."""
    sent = 0
    with _lock:
        while not stop.is_set():
            with closing(store.connect(db_path)) as conn:
                if store.counter(conn, DELETED):  # Accept pressed while a Delete was still running
                    return {"sent": sent, "gone": True}
                rows, install = pending(conn), install_id(conn)
            if not rows:
                break
            try:
                post(f"{api_base}/api/anki/submit", payload(install, rows, addon_version), addon_version)
            except Gone:
                with closing(store.connect(db_path)) as conn:
                    forget(conn)
                return {"sent": sent, "gone": True}
            except (OSError, ValueError) as e:  # unreachable, timeout, HTTP 4xx/5xx (all OSError), bad JSON
                print(f"HowSure: upload paused until the next try ({e})")
                break
            with closing(store.connect(db_path)) as conn:
                store.set_meta(conn, CURSOR, rows[-1]["row_id"])
                store.set_meta(conn, LAST_UPLOAD, datetime.now(timezone.utc).isoformat(timespec="seconds"))
            sent += len(rows)
            if len(rows) < BATCH:
                break
    return {"sent": sent, "gone": False}


def delete_remote(db_path: str, api_base: str, addon_version: str) -> int:
    """Delete everything stored under this install id on the server; returns how many rows it deleted.
    Network errors propagate, so the caller can tell the user that nothing was deleted yet."""
    with _lock:
        with closing(store.connect(db_path)) as conn:
            install = install_id(conn)
        result = post(f"{api_base}/api/anki/delete", {"install_id": install}, addon_version)
        with closing(store.connect(db_path)) as conn:
            forget(conn)
    return int(result["deleted_rows"])


def status(conn) -> dict:
    """For the dashboard: ratings uploaded under the current id, time of the last upload, whether it was deleted."""
    cursor = store.counter(conn, CURSOR)
    return {
        "uploaded": conn.execute("SELECT COUNT(*) FROM ratings WHERE id <= ?", (cursor,)).fetchone()[0],
        "last_upload_at": store.get_meta(conn, LAST_UPLOAD) or None,
        "deleted": bool(store.counter(conn, DELETED)),
    }
