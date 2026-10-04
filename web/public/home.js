// Social proof under the hero on /: from 100 monthly players (the daily KPI job) four numbers replace the static line
// "A new ranked round every day at 00:00 UTC". Countries come from /api/stats (full assessment), the only count of
// countries; communities are the KPI's Slack workspaces, Discord servers, rooms and classrooms.
import { html, api, num } from './ui.js';

export const MIN_PLAYERS = 100;

// [[value, label]] for the strip, or null below MIN_PLAYERS. kpi = GET /api/kpi, stats = GET /api/stats,
// ranked = GET /api/round/stats; the last two may be null (their tiles are then left out).
export function proofTiles(kpi, stats, ranked) {
  if (!(kpi?.mau >= MIN_PLAYERS)) return null;
  const c = kpi.communities ?? {};
  return [
    [num(kpi.mau), 'monthly players'],
    stats?.n_countries ? [num(stats.n_countries), 'countries'] : null,
    [num((c.workspaces ?? 0) + (c.guilds ?? 0) + (c.rooms ?? 0) + (c.classrooms ?? 0)), 'communities'],
    ranked?.players ? [num(ranked.players), 'played today’s ranked round'] : null,
  ].filter(Boolean);
}

export async function renderProof(el) {
  if (!el) return;
  const kpi = await api('/api/kpi');
  if (!kpi.ok || !(kpi.data?.mau >= MIN_PLAYERS)) return;
  const [stats, ranked] = await Promise.all([api('/api/stats'), api('/api/round/stats')]);
  const tiles = proofTiles(kpi.data, stats.ok ? stats.data : null, ranked.ok ? ranked.data : null);
  // PREREG: the double count across surfaces is stated wherever MAU is reported.
  el.innerHTML = html`<div class="tiles">${tiles.map(([value, label]) => html`<div class="tile"><b>${value}</b><span>${label}</span></div>`)}</div>
<p class="fine">Monthly players: anonymous ids with a finished round, full assessment or chat answer in the last 30 days; someone who plays on the web and in Slack counts twice. <a href="/research#numbers">Definitions</a></p>`;
}
