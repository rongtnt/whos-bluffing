// Public stats page: player counts from the daily KPI job (/api/kpi), today's daily game (/api/daily/stats), and the
// full assessment's counters and calibration curve (/api/stats, passed sessions only).
import { html, api, pct, signed, num, calibrationChart, chartLabels } from './ui.js';
import { hitsChart } from './daily.js';

function kpiSection(t, k) {
  const counts = k.as_of
    ? html`<div class="counters">
  <div><b>${num(k.mau)}</b><span>${t('stats.mau')}</span></div>
  <div><b>${num(k.dau)}</b><span>${t('stats.dau')}</span></div>
  <div><b>${num(k.communities.workspaces + k.communities.classrooms)}</b><span>${t('stats.communities')}</span></div>
</div>
<p class="muted small">${t('stats.kpi_detail', { date: k.as_of, web: num(k.mau_by_surface.web), slack: num(k.mau_by_surface.slack), classroom: num(k.mau_by_surface.classroom), workspaces: num(k.communities.workspaces), classrooms: num(k.communities.classrooms) })}</p>
<p class="muted small">${t('stats.anki', { n: num(k.anki_contributors_30d ?? 0) })}</p>`
    : html`<p>${t('stats.kpi_empty')}</p>`;
  return html`<h2>${t('stats.kpi_title')}</h2>${counts}
<p class="muted small">${t('stats.mau_definition')}</p>
<p class="muted small">${t('stats.communities_definition')}</p>`;
}

function dailySection(t, d) {
  if (!d.players) return html`<h2>${t('stats.daily_title')}</h2><p>${t('stats.daily_empty')}</p>`;
  return html`<h2>${t('stats.daily_title')}</h2>
<p>${t('stats.daily_row', { players: num(d.players), avg: d.avg_hits.toFixed(1) })}</p>
<figure>${hitsChart(d.hist, -1, t('daily.hist_title'))}</figure>`;
}

function testSection(t, d) {
  if (!d.n_sessions) return html`<h2>${t('stats.test_title')}</h2><p>${t('stats.empty')}</p>`;
  const b = d.by_lang.en;
  return html`<h2>${t('stats.test_title')}</h2>
<div class="counters">
  <div><b>${num(d.n_sessions)}</b><span>${t('stats.sessions')}</span></div>
  <div><b>${num(d.n_answers)}</b><span>${t('stats.answers')}</span></div>
  <div><b>${num(d.n_countries)}</b><span>${t('stats.countries')}</span></div>
</div>
<h3>${t('stats.curve_title')}</h3>
<figure>${calibrationChart([{ name: t('stats.everyone'), bins: b.bins, cls: 's0' }], chartLabels(t))}</figure>
<p>${t('stats.row', { n: num(b.n), x: signed(Math.round(b.overconf_mean * 100)), h: pct(b.int_hit_mean) })}</p>
<p class="muted small">${t('stats.note')}</p>`;
}

export async function renderStats(ctx) {
  const { app, t } = ctx;
  app.innerHTML = html`<h1>${t('stats.title')}</h1><p class="muted">…</p>`;
  const [kpi, daily, stats] = await Promise.all([api('/api/kpi'), api('/api/daily/stats'), api('/api/stats')]);
  if (!kpi.ok && !stats.ok) {
    app.innerHTML = html`<h1>${t('stats.title')}</h1><p class="msg">${t('stats.failed')}</p>`;
    return;
  }
  app.innerHTML = html`<h1>${t('stats.title')}</h1>
${kpi.ok ? html`<section>${kpiSection(t, kpi.data)}</section>` : ''}
${daily.ok ? html`<section>${dailySection(t, daily.data)}</section>` : ''}
${stats.ok ? html`<section>${testSection(t, stats.data)}</section>` : ''}`;
}
