// Public stats page: counters plus the global calibration curve per test language (passed sessions only).
import { html, api, pct, signed, num, calibrationChart, chartLabels } from './ui.js';

export async function renderStats(ctx) {
  const { app, t, lang } = ctx;
  app.innerHTML = html`<h1>${t('stats.title')}</h1><div id="stats"><p class="muted">…</p></div>`;
  const el = app.querySelector('#stats');
  const r = await api('/api/stats');
  if (!r.ok) { el.innerHTML = html`<p class="msg">${t('stats.failed')}</p>`; return; }
  const d = r.data;
  if (!d.n_sessions) { el.innerHTML = html`<p>${t('stats.empty')}</p>`; return; }
  const langs = ['en', 'zh'].filter((l) => d.by_lang[l].n > 0);
  const series = langs.map((l) => ({ name: t(`meta.lang_${l}`), bins: d.by_lang[l].bins, cls: l === 'en' ? 's0' : 's1' }));
  const row = (l) => {
    const b = d.by_lang[l];
    return html`<li>${t('stats.row', { lang: t(`meta.lang_${l}`), n: num(b.n, lang), x: signed(Math.round(b.overconf_mean * 100)), h: pct(b.int_hit_mean) })}</li>`;
  };
  el.innerHTML = html`<div class="counters">
  <div><b>${num(d.n_sessions, lang)}</b><span>${t('stats.sessions')}</span></div>
  <div><b>${num(d.n_answers, lang)}</b><span>${t('stats.answers')}</span></div>
  <div><b>${num(d.n_countries, lang)}</b><span>${t('stats.countries')}</span></div>
</div>
<h2>${t('stats.curve_title')}</h2>
<figure>${calibrationChart(series, chartLabels(t))}</figure>
<ul class="plain">${langs.map(row)}</ul>
<p class="muted small">${t('stats.note')}</p>`;
}
