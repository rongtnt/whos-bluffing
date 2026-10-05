// The home page (/): the hero's Discord · Slack · Web switch, the question list's pause button and the "N played today"
// line under Get started (from 100 players in today's ranked round; nothing under that). And the live panel, the first
// section of /stats, graphics with one short label each: today's room as a calibration chart (from 20 players, else
// yesterday's, else a grey example), the day's biggest bluffs as stamped receipts (the API sends up to three from 5
// players, never who; else two grey examples) and the five types as tiles with a tooltip.
import { html, api, num, signed } from './ui.js';

export const MIN_PLAYERS = 100;
export const MIN_ROOM = 20;

// "1,204 played today" from MIN_PLAYERS players in today's ranked round (ranked = GET /api/round/stats, or null), else null.
export const playedLine = (ranked) => (ranked?.players >= MIN_PLAYERS ? `${num(ranked.players)} played today` : null);

export async function renderPlayed(el) {
  if (!el) return;
  const r = await api('/api/round/stats');
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

// The room chart: confidence 50-100% across, share right 0-100% up, the dashed diagonal where they would match, one dot
// per confidence with answers (bigger = more answers). example: grey dots (the page's static example).
const CHART = { W: 200, H: 160, L: 40, R: 8, T: 8, B: 22 };
const r1 = (v) => Math.round(v * 10) / 10;
export function roomChart(points, { example = false } = {}) {
  const { W, H, L, R, T, B } = CHART;
  const x = (c) => r1(L + ((c - 50) / 50) * (W - L - R));
  const y = (share) => r1(T + (1 - share) * (H - T - B));
  const shown = points.filter((p) => p.n > 0);
  const most = Math.max(1, ...shown.map((p) => p.n));
  return html`<svg class="room-chart${example ? ' is-example' : ''}" viewBox="0 0 ${W} ${H}" role="img" aria-label="How sure against how often right"><path class="room-axis" d="M${L} ${T}V${H - B}H${W - R}"/><path class="room-ideal" d="M${x(50)} ${y(0.5)}L${x(100)} ${y(1)}"/>${shown.map((p) => html`<circle cx="${x(p.conf)}" cy="${y(p.right / p.n)}" r="${r1(3 + 3 * Math.sqrt(p.n / most))}"/>`)}<text x="${L - 5}" y="${T + 7}" text-anchor="end">100%</text><text x="${L - 5}" y="${H - B}" text-anchor="end">0%</text><text x="${L}" y="${H - 6}">50%</text><text x="${r1((L + W - R) / 2)}" y="${H - 6}" text-anchor="middle">sure</text><text x="${W - R}" y="${H - 6}" text-anchor="end">100%</text><text transform="rotate(-90)" x="${-r1((T + H - B) / 2)}" y="10" text-anchor="middle">right</text></svg>`;
}
// An overconfident room, drawn grey under the label "Example" until there is a real one.
export const EXAMPLE_ROOM = [[50, 30, 15], [60, 40, 22], [70, 50, 30], [80, 60, 38], [90, 50, 33], [100, 40, 28]].map(([conf, n, right]) => ({ conf, n, right }));

// One bluff from the API as a receipt: the question, the wrong pick struck through, the points, the game's BLUFF stamp.
export const receipt = (b) => html`<li class="receipt"><span class="receipt-q">${b.prompt}</span><span class="receipt-pick"><s>${b.pick}</s><b>${signed(b.points)}</b></span><span class="stamp stamp-bluff" data-stake="${b.conf}">BLUFF</span></li>`;
export const EXAMPLE_BLUFFS = [{ prompt: 'Which is longer?', pick: 'The Danube', conf: 100, points: -300 }, { prompt: 'Which is higher?', pick: 'K2', conf: 90, points: -224 }];

// What the chart shows: today's room from MIN_ROOM players, else yesterday's, else null (the page keeps its example).
export function roomView(today, yesterday) {
  for (const [day, stats] of [['Today', today], ['Yesterday', yesterday]]) {
    if (stats?.players >= MIN_ROOM) return { points: stats.calibration ?? [], cap: `${day}’s room · ${num(stats.players)} played`, live: day === 'Today' };
  }
  return null;
}

// Swaps the page's examples for real numbers where there are some, in one go and hidden until then (styles.css keeps
// every size, so nothing moves). The type tiles are wired first: they work while the numbers load.
export async function renderLive(el) {
  if (!el) return;
  wireTypes(el);
  const today = await api('/api/round/stats');
  const t = today.ok ? today.data : null;
  const y = t?.players >= MIN_ROOM ? null : await api(`/api/round/stats?date=${new Date(Date.now() - 864e5).toISOString().slice(0, 10)}`);
  const room = roomView(t, y?.ok ? y.data : null);
  if (room) {
    el.querySelector('[data-room-chart]').innerHTML = roomChart(room.points);
    el.querySelector('[data-room-cap]').innerHTML = html`${room.live ? html`<span class="live-dot anim" aria-hidden="true"></span>` : ''}${room.cap}`;
  }
  if (t?.bluffs?.length) {
    const list = el.querySelector('[data-receipts]');
    list.innerHTML = html`${t.bluffs.map(receipt)}`;
    list.classList.remove('is-example');
    el.querySelector('[data-receipts-cap]').textContent = 'Biggest bluffs today';
  }
  el.querySelector('[data-live-top]').classList.add('is-filled');
}

// A tap opens a type's tooltip (hover and keyboard focus open it in CSS); tapping it again, or another type, closes it.
function wireTypes(el) {
  const tiles = [...el.querySelectorAll('.type-tile')];
  for (const tile of tiles) {
    tile.addEventListener('click', () => {
      const open = tile.getAttribute('aria-pressed') !== 'true';
      for (const other of tiles) other.setAttribute('aria-pressed', String(open && other === tile));
    });
  }
}
