"""Tools > "HowSure: my calibration": one dialog, HTML + inline SVG, no external assets."""
import html
import os
from collections.abc import Callable
from datetime import date
from functools import partial

from aqt import mw
from aqt.qt import QDialog, QHBoxLayout, QPushButton, QVBoxLayout
from aqt.utils import getSaveFile, openFolder, tooltip
from aqt.webview import AnkiWebView

from . import hooks, i18n, metrics, store

W, H, PAD = 460, 220, 40  # chart size and inner margin, px
TREND_DAYS = 30
Tr = Callable[..., str]  # i18n.t bound to a language

CSS = """
.hs { max-width: 520px; margin: 0 auto; padding: 8px 12px; text-align: left; }
.hs h3 { margin: 18px 0 4px; font-size: 15px; }
.hs svg { width: 100%; height: auto; display: block; }
.hs .grid { stroke: var(--border, #ccc); stroke-width: 1; }
.hs .axis { fill: var(--fg, #222); font-size: 11px; opacity: .75; }
.hs .bar { fill: var(--accent-card, #3b82f6); opacity: .85; }
.hs .conf { stroke: var(--fg, #222); stroke-width: 2; stroke-dasharray: 4 3; fill: none; }
.hs .recall-line { stroke: var(--accent-card, #3b82f6); stroke-width: 2; fill: none; }
.hs .recall-dot { fill: var(--accent-card, #3b82f6); }
.hs .conf-dot { fill: var(--fg, #222); }
.hs .legend { font-size: 12px; opacity: .85; margin: 2px 0 0; }
.hs .key-bar { display: inline-block; width: 10px; height: 10px; background: var(--accent-card, #3b82f6); }
.hs .key-conf { display: inline-block; width: 14px; border-top: 2px dashed var(--fg, #222); vertical-align: middle; }
.hs table { border-collapse: collapse; width: 100%; font-size: 13px; }
.hs th, .hs td { padding: 3px 6px; border-bottom: 1px solid var(--border, #ccc); }
.hs td.num, .hs th.num { text-align: right; }
.hs .foot { font-size: 12px; opacity: .75; margin-top: 18px; }
"""


def _pct(x: float | None) -> str:
    return "–" if x is None else f"{x * 100:.0f}%"


def _pp(x: float | None, t: Tr) -> str:
    return "–" if x is None else t("pp", v=f"{x * 100:+.0f}")


def _y(v: float) -> float:
    """Value in [0, 1] -> SVG y coordinate."""
    return PAD + (H - 2 * PAD) * (1 - v)


def _svg(parts: list[str], label: str) -> str:
    return f'<svg viewBox="0 0 {W} {H}" role="img" aria-label="{html.escape(label)}">{"".join(parts)}</svg>'


def _grid() -> list[str]:
    out = []
    for v in (0, 0.25, 0.5, 0.75, 1):
        y = _y(v)
        out.append(f'<line class="grid" x1="{PAD}" x2="{W - PAD}" y1="{y:.1f}" y2="{y:.1f}"/>')
        out.append(f'<text class="axis" x="{PAD - 6}" y="{y + 4:.1f}" text-anchor="end">{v * 100:.0f}%</text>')
    return out


def _legend(t: Tr) -> str:
    return (f'<p class="legend"><span class="key-bar"></span> {t("recall")} &nbsp; '
            f'<span class="key-conf"></span> {t("confidence")}</p>')


def reliability_svg(summaries: dict[int, dict], t: Tr) -> str:
    """Rating 1-5 on x; bar = recall rate, dashed mark = mapped confidence, n on top."""
    step = (W - 2 * PAD) / len(summaries)
    out = _grid()
    for i, (j, s) in enumerate(sorted(summaries.items())):
        x = PAD + i * step
        if s["n"]:
            y = _y(s["recall"])
            out.append(f'<rect class="bar" x="{x + step * .2:.1f}" y="{y:.1f}" '
                       f'width="{step * .6:.1f}" height="{_y(0) - y:.1f}"/>')
        yc = _y(metrics.JOL_CONF[j])
        out.append(f'<line class="conf" x1="{x + step * .1:.1f}" x2="{x + step * .9:.1f}" '
                   f'y1="{yc:.1f}" y2="{yc:.1f}"/>')
        out.append(f'<text class="axis" x="{x + step / 2:.1f}" y="{H - PAD + 16}" text-anchor="middle">{j}</text>')
        out.append(f'<text class="axis" x="{x + step / 2:.1f}" y="{PAD - 10}" text-anchor="middle">n={s["n"]}</text>')
    out.append(f'<text class="axis" x="{W / 2}" y="{H - 6}" text-anchor="middle">{html.escape(t("rating"))}</text>')
    return _svg(out, t("reliability"))


def trend_svg(days: list[tuple[date, dict]], t: Tr) -> str:
    """Daily recall rate (line) and mean mapped confidence (dashed) for days with ratings."""
    step = (W - 2 * PAD) / max(len(days) - 1, 1)
    out = _grid()
    for key, line_cls, dot_cls in (("recall", "recall-line", "recall-dot"), ("conf", "conf", "conf-dot")):
        pts = [(PAD + i * step, _y(s[key])) for i, (_, s) in enumerate(days) if s["n"]]
        if len(pts) > 1:
            out.append(f'<polyline class="{line_cls}" points="{" ".join(f"{x:.1f},{y:.1f}" for x, y in pts)}"/>')
        out.extend(f'<circle class="{dot_cls}" cx="{x:.1f}" cy="{y:.1f}" r="2.5"/>' for x, y in pts)
    out.append(f'<text class="axis" x="{PAD}" y="{H - PAD + 16}">{days[0][0].isoformat()}</text>')
    out.append(f'<text class="axis" x="{W - PAD}" y="{H - PAD + 16}" text-anchor="end">{days[-1][0].isoformat()}</text>')
    return _svg(out, t("trend"))


def deck_table(rows: list[dict], names: dict[str, str], t: Tr) -> str:
    head = (f'<tr><th>{t("deck")}</th><th class="num">{t("count")}</th><th class="num">{t("mean_rating")}</th>'
            f'<th class="num">{t("recall")}</th><th class="num">{t("overconfidence")}</th></tr>')
    body = []
    for deck_hash, s in sorted(metrics.by_key(rows, "deck_hash").items(), key=lambda kv: -kv[1]["n"]):
        name = names.get(deck_hash) or t("deleted_deck", h=deck_hash[:8])
        body.append(f'<tr><td>{html.escape(name)}</td><td class="num">{s["n"]}</td>'
                    f'<td class="num">{s["mean_jol"]:.1f}</td><td class="num">{_pct(s["recall"])}</td>'
                    f'<td class="num">{_pp(s["overconfidence"], t)}</td></tr>')
    return f"<table>{head}{''.join(body)}</table>"


def render(rows: list[dict], unrated: int, names: dict[str, str], lang: str, today: date | None = None) -> str:
    """Dashboard body HTML. names maps deck_hash -> deck name (resolved locally, never stored)."""
    t = partial(i18n.t, lang)
    if not rows:
        return f'<style>{CSS}</style><div class="hs"><p>{t("empty")}</p></div>'
    overall = metrics.summarize(rows)
    return (
        f'<style>{CSS}</style><div class="hs">'
        f'<p>{t("summary", n=len(rows), unrated=unrated)}<br>'
        f'{t("overall", pp=_pp(overall["overconfidence"], t))}</p>'
        f'<h3>{t("reliability")}</h3>{reliability_svg(metrics.by_rating(rows), t)}{_legend(t)}'
        f'<h3>{t("by_deck")}</h3>{deck_table(rows, names, t)}'
        f'<h3>{t("trend")}</h3>{trend_svg(metrics.by_day(rows, TREND_DAYS, today), t)}{_legend(t)}'
        f'<p class="foot">{t("footnote")}</p></div>'
    )


def _export(parent: QDialog, t: Tr) -> None:
    path = getSaveFile(parent, t("export"), "howsure", "CSV", ".csv", "howsure.csv")
    if not path:
        return
    with hooks.db() as conn:
        n = store.export_csv(conn, path)
    tooltip(t("exported", n=n), parent=parent)


def show() -> None:
    lang = hooks.lang()
    t = partial(i18n.t, lang)
    with hooks.db() as conn:
        rows, unrated, salt = store.rows(conn), store.counter(conn, hooks.UNRATED), store.salt(conn)
    names = {store.hash_id(salt, d.id): d.name for d in mw.col.decks.all_names_and_ids()}

    dialog = QDialog(mw)
    dialog.setWindowTitle(t("dlg_title"))
    web = AnkiWebView(parent=dialog, title="howsure_dashboard")
    web.stdHtml(render(rows, unrated, names, lang), context=dialog)
    export_btn = QPushButton(t("export"))
    export_btn.clicked.connect(lambda: _export(dialog, t))
    folder_btn = QPushButton(t("open_folder"))
    folder_btn.clicked.connect(lambda: openFolder(os.path.dirname(hooks.DB_PATH)))
    buttons = QHBoxLayout()
    buttons.addWidget(export_btn)
    buttons.addWidget(folder_btn)
    buttons.addStretch()
    layout = QVBoxLayout(dialog)
    layout.addWidget(web)
    layout.addLayout(buttons)
    dialog.resize(600, 820)
    dialog.exec()
    web.cleanup()
