// Only the all-time player count is public. Activity windows require the owner API key.
import { api, num } from './ui.js';

export function apiVerdict(r, ms) {
  if (r.ok) return { state: ms > 1500 ? 'slow' : 'up', text: '' };
  return { state: 'down', text: 'Player count unavailable. Please try again later.' };
}

async function main() {
  const t0 = performance.now();
  const r = await api('/api/players');
  const verdict = apiVerdict(r, performance.now() - t0);
  document.querySelector('[data-api-dot]').dataset.state = verdict.state;
  document.querySelector('[data-api-text]').textContent = verdict.text;
  document.querySelector('[data-api-text]').closest('[role="status"]').hidden = r.ok;
  if (r.ok && Number.isInteger(r.data?.total_players)) document.querySelector('[data-player-count]').textContent = num(r.data.total_players);
}
if (typeof document !== 'undefined') main();
