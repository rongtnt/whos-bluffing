// /status: one timed request to /api/round/stats (is the game server up?) and the latest KPI row (/api/kpi), filled
// into the page's fixed slots so nothing moves.
import { api, num } from './ui.js';

const SLOW_MS = 1500;

export function apiVerdict(r, ms) {
  if (r.ok) return { state: ms > SLOW_MS ? 'slow' : 'up', text: `Up · answered in ${Math.round(ms).toLocaleString('en-US')} ms` };
  if (r.status === 0) return { state: 'down', text: 'Not reachable from here. Check your connection, then reload.' };
  return { state: 'down', text: `Not answering properly (HTTP ${r.status})` };
}

export function kpiVerdict(kpi) {
  if (!kpi) return { state: 'down', text: 'The numbers could not be loaded.' };
  if (!kpi.as_of) return { state: 'wait', text: 'No daily run yet.' };
  return { state: 'up', text: `Latest run counted ${kpi.as_of} (UTC).` };
}

const show = (dot, textEl, v) => {
  dot.dataset.state = v.state;
  textEl.textContent = v.text;
};

async function main() {
  const t0 = performance.now();
  const stats = await api('/api/round/stats');
  show(document.querySelector('[data-api-dot]'), document.querySelector('[data-api-text]'), apiVerdict(stats, performance.now() - t0));
  const kpi = await api('/api/kpi');
  const k = kpi.ok ? kpi.data : null;
  show(document.querySelector('[data-kpi-dot]'), document.querySelector('[data-kpi-text]'), kpiVerdict(k));
  const c = k?.communities ?? {};
  const values = {
    mau: k?.as_of ? num(k.mau) : null,
    dau: k?.as_of ? num(k.dau) : null,
    communities: k?.as_of ? num((c.workspaces ?? 0) + (c.guilds ?? 0) + (c.rooms ?? 0) + (c.classrooms ?? 0)) : null,
    ranked: stats.ok ? num(stats.data.players) : null,
  };
  for (const el of document.querySelectorAll('[data-kpi]')) if (values[el.dataset.kpi] != null) el.textContent = values[el.dataset.kpi];
}

if (typeof document !== 'undefined') main();
