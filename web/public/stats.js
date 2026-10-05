// Public stats page, under its title and the live panel (stats.html, home.js): today's ranked round
// (/api/round/stats) and the full assessment's calibration curve (/api/stats, passed sessions only). Charts and
// percentages only: counts of players are collected privately and never shown.
import { html, api, pct, signed, calibrationChart, chartLabels } from './ui.js';
import { scoreChart } from './rounds.js';

function rankedSection(t, s) {
  if (!s.players) return html`<h2>${t('stats.ranked_title')}</h2><p>${t('stats.ranked_empty')}</p>`;
  return html`<h2>${t('stats.ranked_title')}</h2>
<p>${t('stats.ranked_row', { x: signed(Math.round(s.mean_overconfidence)) })}</p>
<figure>${scoreChart(s, null, t('stats.ranked_chart'))}</figure>`;
}

function testSection(t, d) {
  if (!d.n_sessions) return html`<h2>${t('stats.test_title')}</h2><p>${t('stats.empty')}</p>`;
  const b = d.by_lang.en;
  return html`<h2>${t('stats.test_title')}</h2>
<h3>${t('stats.curve_title')}</h3>
<figure>${calibrationChart([{ name: t('stats.everyone'), bins: b.bins, cls: 's0' }], chartLabels(t))}</figure>
<p>${t('stats.row', { x: signed(Math.round(b.overconf_mean * 100)), h: pct(b.int_hit_mean) })}</p>
<p class="muted small">${t('stats.note')}</p>`;
}

export async function renderStats(ctx) {
  const { app, t } = ctx;
  app.innerHTML = html`<p class="muted">…</p>`;
  const [ranked, stats] = await Promise.all([api('/api/round/stats'), api('/api/stats')]);
  if (!ranked.ok && !stats.ok) {
    app.innerHTML = html`<p class="msg">${t('stats.failed')}</p>`;
    return;
  }
  app.innerHTML = html`${ranked.ok ? html`<section>${rankedSection(t, ranked.data)}</section>` : ''}
${stats.ok ? html`<section>${testSection(t, stats.data)}</section>` : ''}`;
}
