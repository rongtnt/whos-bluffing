import { api, num } from './ui.js';

export const MIN_PLAYERS = 100;

// Show the same public total used by /status.
export const playedLine = (counts) => (counts?.total_players >= MIN_PLAYERS ? `${num(counts.total_players)} total players` : null);

export async function renderPlayed(el) {
  if (!el) return;
  const r = await api('/api/players');
  const line = playedLine(r.ok ? r.data : null);
  if (line) { el.textContent = line; el.hidden = false; }
}

// The switch over the hero's mocks: a tap shows that surface (styles.css keeps the three in one place).
export function wireSurfaces(root) {
  if (!root) return;
  const buttons = [...root.querySelectorAll('[data-surface]')];
  for (const b of buttons) {
    b.addEventListener('click', () => {
      for (const other of buttons) other.setAttribute('aria-pressed', String(other === b));
      root.dataset.show = b.dataset.surface;
    });
  }
}

// The question list drifts up until its button pauses it (and again until it is pressed once more).
export function wirePause(root) {
  const button = root?.querySelector('[data-prompts-pause]');
  if (!button) return;
  button.addEventListener('click', () => {
    const paused = button.getAttribute('aria-pressed') !== 'true';
    button.setAttribute('aria-pressed', String(paused));
    button.setAttribute('aria-label', paused ? 'Play the list' : 'Pause the list');
    root.toggleAttribute('data-paused', paused);
  });
}
