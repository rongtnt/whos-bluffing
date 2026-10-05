// /status: one timed request to /api/round/stats (is the game server up?), filled into the page's fixed slot so nothing
// moves. Usage figures are not shown: they are collected privately.
import { api } from './ui.js';

const SLOW_MS = 1500;

export function apiVerdict(r, ms) {
  if (r.ok) return { state: ms > SLOW_MS ? 'slow' : 'up', text: `Up · answered in ${Math.round(ms).toLocaleString('en-US')} ms` };
  if (r.status === 0) return { state: 'down', text: 'Not reachable from here. Check your connection, then reload.' };
  return { state: 'down', text: `Not answering properly (HTTP ${r.status})` };
}

async function main() {
  const t0 = performance.now();
  const stats = await api('/api/round/stats');
  const v = apiVerdict(stats, performance.now() - t0);
  document.querySelector('[data-api-dot]').dataset.state = v.state;
  document.querySelector('[data-api-text]').textContent = v.text;
}

if (typeof document !== 'undefined') main();
