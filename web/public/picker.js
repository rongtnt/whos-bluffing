// Pack and difficulty for quick rounds: the chips and the segment in the home page's packs band (index.html;
// scripts/sync-pages.js writes the chips with the difficulties each pack has enough questions for). The choice is kept
// in localStorage, ?pack= and ?difficulty= in the address pick one for a link, and a tap writes them into the address,
// so the link remembers the pick. The ranked round ignores both.
import { store } from './ui.js';
import { PACKS, DEFAULT_PACK, DEFAULT_DIFFICULTY, packLabel, difficultyLabel } from './packs.js';
import { typeName } from './types.js';

const PACK_KEY = 'whosbluffing_pack';
const DIFFICULTY_KEY = 'whosbluffing_difficulty';
export const ORDER = ['easy', 'normal', 'brutal'];

// The difficulty in `levels` closest to `from` (itself when it is there; the easier one on a tie).
export function nearestDifficulty(from, levels) {
  if (!levels?.length || levels.includes(from)) return from;
  const i = ORDER.indexOf(from);
  const gap = (d) => Math.abs(ORDER.indexOf(d) - i);
  return [...levels].sort((x, y) => gap(x) - gap(y) || ORDER.indexOf(x) - ORDER.indexOf(y))[0];
}

// A wanted {pack, difficulty} made valid against the offer ({pack: [difficulties]}): unknown values become the
// defaults; a pack the difficulty cannot fill keeps the pack and moves the difficulty to the nearest one that can.
export function settle(want, offer) {
  const difficulty = ORDER.includes(want?.difficulty) ? want.difficulty : DEFAULT_DIFFICULTY;
  const pack = Object.hasOwn(offer, want?.pack ?? '') ? want.pack : DEFAULT_PACK;
  return { pack, difficulty: nearestDifficulty(difficulty, offer[pack]) };
}

// A tap: a pack the current difficulty cannot fill moves the difficulty; a difficulty the current pack cannot fill
// moves the pack to All. Returns {pack, difficulty, note} (note: what moved, for the status line, or '').
export function choose(state, change, offer) {
  if (change.pack) {
    const difficulty = nearestDifficulty(state.difficulty, offer[change.pack]);
    const note = difficulty === state.difficulty ? '' : `${packLabel(change.pack)} needs ${difficultyLabel(difficulty)}, so the difficulty is ${difficultyLabel(difficulty)} now.`;
    return { pack: change.pack, difficulty, note };
  }
  const keep = offer[state.pack]?.includes(change.difficulty);
  const note = keep ? '' : `${packLabel(state.pack)} has too few ${difficultyLabel(change.difficulty)} questions, so the pack is All now.`;
  return { pack: keep ? state.pack : DEFAULT_PACK, difficulty: change.difficulty, note };
}

// What the page offers: {pack: [difficulties]} from the chips; without chips (challenge pages) every known pack at
// every difficulty, and the server has the last word.
function offerFrom(chips) {
  if (!chips.length) return Object.fromEntries(Object.keys(PACKS).map((k) => [k, ORDER]));
  return Object.fromEntries(chips.map((c) => [c.dataset.pack, c.dataset.difficulties.split(' ')]));
}

// Wires the page's picker (if it has one) and returns {current()}: the choice for the next quick round. onPick runs
// after each tap.
export function initPicker(doc = document, { onPick } = {}) {
  const chips = [...doc.querySelectorAll('[data-pack]')];
  const levels = [...doc.querySelectorAll('[data-difficulty]')];
  const line = doc.querySelector('[data-difficulty-line]');
  const status = doc.querySelector('[data-pick-status]');
  const offer = offerFrom(chips);
  const q = new URLSearchParams(location.search);
  let state = settle({
    pack: q.get('pack') ?? store.get(PACK_KEY, DEFAULT_PACK),
    difficulty: q.get('difficulty') ?? store.get(DIFFICULTY_KEY, DEFAULT_DIFFICULTY),
  }, offer);
  const paint = () => {
    for (const c of chips) {
      const plays = offer[c.dataset.pack].includes(state.difficulty);
      c.setAttribute('aria-pressed', String(c.dataset.pack === state.pack));
      c.classList.toggle('off', !plays); // dashed: a tap moves the difficulty to one this pack plays at
      if (plays) c.removeAttribute('title');
      else c.title = `Plays at ${offer[c.dataset.pack].map(difficultyLabel).join(', ')}`;
    }
    for (const b of levels) b.setAttribute('aria-pressed', String(b.dataset.difficulty === state.difficulty));
    const current = levels.find((b) => b.dataset.difficulty === state.difficulty);
    if (line && current) line.textContent = current.dataset.line;
  };
  const apply = (change) => {
    const next = choose(state, change, offer);
    state = { pack: next.pack, difficulty: next.difficulty };
    store.set(PACK_KEY, state.pack);
    store.set(DIFFICULTY_KEY, state.difficulty);
    paint();
    if (status) status.textContent = next.note;
    const url = new URL(location.href); // other parameters (a class code) stay
    url.searchParams.set('pack', state.pack);
    url.searchParams.set('difficulty', state.difficulty);
    history.replaceState(history.state, '', url);
    onPick?.();
  };
  for (const c of chips) c.addEventListener('click', () => apply({ pack: c.dataset.pack }));
  for (const b of levels) b.addEventListener('click', () => apply({ difficulty: b.dataset.difficulty }));
  if (chips.length) paint();
  return { current: () => ({ ...state }) };
}

// "Quick round · Geography · Brutal" and the like, for the round's badge and the end screen.
export const quickLabel = (pack, difficulty) => `${packLabel(pack ?? DEFAULT_PACK)} · ${difficultyLabel(difficulty ?? DEFAULT_DIFFICULTY)}`;

// The share text with the type's display name (the API's text names the type as stored, types.js), the pack after the
// name ("Who's Bluffing? · Geography pack · …") unless the pack is All, and the round's best reaction line on its own
// line under the score, before the link.
export function shareWith(text, { pack, line, url, type } = {}) {
  let out = type ? text.replace(` · ${type} · `, ` · ${typeName(type)} · `) : text;
  if (pack && pack !== DEFAULT_PACK && PACKS[pack]) out = out.replace(/^(Who's Bluffing\?) · /, `$1 · ${packLabel(pack)} pack · `);
  if (line) {
    const tail = url ? ` · ${url}` : '';
    out = tail && out.endsWith(tail) ? `${out.slice(0, -tail.length)}\n“${line}”\n${url}` : `${out}\n“${line}”`;
  }
  return out;
}
