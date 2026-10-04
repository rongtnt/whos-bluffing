// Social proof under the hero on /: from 100 monthly players (the daily KPI job) four numbers replace the static line
// "A new game every day at 00:00 UTC". Countries come from /api/stats (full assessment), the only count of countries.
import { html, api, num } from './ui.js';

export const MIN_PLAYERS = 100;

// [[value, label]] for the strip, or null below MIN_PLAYERS. kpi = GET /api/kpi, stats = GET /api/stats,
// daily = GET /api/daily/stats; the last two may be null (their tiles are then left out).
export function proofTiles(kpi, stats, daily) {
  if (!(kpi?.mau >= MIN_PLAYERS)) return null;
  return [
    [num(kpi.mau), 'monthly players'],
    stats?.n_countries ? [num(stats.n_countries), 'countries'] : null,
    [num(kpi.communities?.workspaces ?? 0), 'Slack workspaces'],
    daily?.players ? [daily.avg_hits.toFixed(1), 'today’s average score'] : null,
  ].filter(Boolean);
}

export async function renderProof(el) {
  if (!el) return;
  const kpi = await api('/api/kpi');
  if (!kpi.ok || !(kpi.data?.mau >= MIN_PLAYERS)) return;
  const [stats, daily] = await Promise.all([api('/api/stats'), api('/api/daily/stats')]);
  const tiles = proofTiles(kpi.data, stats.ok ? stats.data : null, daily.ok ? daily.data : null);
  // PREREG: the double count across surfaces is stated wherever MAU is reported.
  el.innerHTML = html`<div class="tiles">${tiles.map(([value, label]) => html`<div class="tile"><b>${value}</b><span>${label}</span></div>`)}</div>
<p class="fine">Monthly players: anonymous ids with a finished game in the last 30 days; someone who plays on the web and in Slack counts twice. <a href="/research#numbers">Definitions</a></p>`;
}
