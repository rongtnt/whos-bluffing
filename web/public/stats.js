// Public stats page: player counts and engagement from the daily KPI job (/api/kpi), today's ranked round
// (/api/round/stats), and the full assessment's counters and calibration curve (/api/stats, passed sessions only).
import { html, api, pct, signed, num, calibrationChart, chartLabels } from './ui.js';
import { scoreChart } from './rounds.js';

const communities = (c) => c.workspaces + (c.guilds ?? 0) + (c.rooms ?? 0) + c.classrooms;

function kpiSection(t, k) {
  const s = k.mau_by_surface;
  const c = k.communities;
  const counts = k.as_of
    ? html`<div class="counters">
  <div><b>${num(k.mau)}</b><span>${t('stats.mau')}</span></div>
  <div><b>${num(k.dau)}</b><span>${t('stats.dau')}</span></div>
  <div><b>${num(communities(c))}</b><span>${t('stats.communities')}</span></div>
</div>
<p class="muted small">${t('stats.kpi_detail', { date: k.as_of, web: num(s.web), slack: num(s.slack), discord: num(s.discord ?? 0), room: num(s.room ?? 0),
  classroom: num(s.classroom), workspaces: num(c.workspaces), guilds: num(c.guilds ?? 0), rooms: num(c.rooms ?? 0), classrooms: num(c.classrooms) })}</p>
<p class="muted small">${t('stats.anki', { n: num(k.anki_contributors_30d ?? 0) })}</p>`
    : html`<p>${t('stats.kpi_empty')}</p>`;
  return html`<h2>${t('stats.kpi_title')}</h2>${counts}
<p class="muted small">${t('stats.mau_definition')}</p>
<p class="muted small">${t('stats.communities_definition')}</p>`;
}

const share = (x) => (x == null ? '–' : `${pct(x)}%`);

// The engagement numbers PREREG reports (trailing 30 days), each with its one-line definition.
function engagementSection(t, k) {
  if (!k.as_of) return '';
  const tiles = [
    [k.rounds_per_player_day == null ? '–' : k.rounds_per_player_day.toFixed(2), t('stats.engagement_rounds')],
    [share(k.d1_return), t('stats.engagement_d1')],
    [share(k.d7_return), t('stats.engagement_d7')],
    [share(k.challenge_conversion), t('stats.engagement_challenge')],
    [share(k.share_rate), t('stats.engagement_share')],
  ];
  return html`<h2>${t('stats.engagement_title')}</h2>
<div class="tiles tiles-5">${tiles.map(([v, label]) => html`<div class="tile"><b>${v}</b><span>${label}</span></div>`)}</div>
<ul class="defs muted small">
  <li>${t('stats.engagement_rounds_def')}</li>
  <li>${t('stats.engagement_return_def')}</li>
  <li>${t('stats.engagement_challenge_def')}</li>
  <li>${t('stats.engagement_share_def')}</li>
</ul>
<p class="muted small">${t('stats.engagement_note')}</p>`;
}

function rankedSection(t, s) {
  if (!s.players) return html`<h2>${t('stats.ranked_title')}</h2><p>${t('stats.ranked_empty')}</p>`;
  return html`<h2>${t('stats.ranked_title')}</h2>
<p>${t('stats.ranked_row', { players: num(s.players), x: signed(Math.round(s.mean_overconfidence)) })}</p>
<figure>${scoreChart(s, null, t('stats.ranked_chart'))}</figure>`;
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
  const [kpi, ranked, stats] = await Promise.all([api('/api/kpi'), api('/api/round/stats'), api('/api/stats')]);
  if (!kpi.ok && !stats.ok) {
    app.innerHTML = html`<h1>${t('stats.title')}</h1><p class="msg">${t('stats.failed')}</p>`;
    return;
  }
  app.innerHTML = html`<h1>${t('stats.title')}</h1>
${kpi.ok ? html`<section>${kpiSection(t, kpi.data)}</section><section>${engagementSection(t, kpi.data)}</section>` : ''}
${ranked.ok ? html`<section>${rankedSection(t, ranked.data)}</section>` : ''}
${stats.ok ? html`<section>${testSection(t, stats.data)}</section>` : ''}`;
}
