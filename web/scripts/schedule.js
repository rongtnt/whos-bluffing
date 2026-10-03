// npm run schedule: fills daily/schedule.json (repo root) up to 120 days ahead (UTC), 5 pool items a day.
// Existing days are never changed: past days have been played, and future days may have been hand-edited during the
// nightly review. Each new day gets 5 different categories (least recently used first), no item that appears on any
// other day within 180 days, and, once daily/runtime.json exists, a difficulty mix (else plain category rotation).
// daily/runtime.json = items_runtime exported from D1 (README: "Difficulty data"); retired items are never scheduled.
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { addDays, todayUTC } from '../functions/_daily.js';

export const DAYS_AHEAD = 120;
export const PER_DAY = 5;
export const NO_REUSE_DAYS = 180;
const MIN_ANSWERS = 30; // an item gets a runtime difficulty once this many people answered it
const MIX = ['easy', 'medium', 'hard', 'medium', 'easy']; // target difficulty per slot when runtime data exists
const DAY_MS = 86400000;
const daysBetween = (a, b) => Math.abs(Date.parse(`${a}T00:00:00Z`) - Date.parse(`${b}T00:00:00Z`)) / DAY_MS;

// Seeded PRNG (FNV-1a seed + mulberry32): a day's picks depend only on its date and the inputs.
function seeded(text) {
  let a = [...text].reduce((h, c) => Math.imul(h ^ c.charCodeAt(0), 16777619), 2166136261) >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), a | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// runtime rows [{item_id, n_answers, n_hits}] -> Map id -> 'easy' (>= 70% of ranges hit) | 'medium' | 'hard' (< 40%).
export function difficultyTiers(runtime) {
  const tiers = new Map();
  for (const r of runtime) {
    if (r.n_answers < MIN_ANSWERS) continue;
    const rate = r.n_hits / r.n_answers;
    tiers.set(r.item_id, rate >= 0.7 ? 'easy' : rate < 0.4 ? 'hard' : 'medium');
  }
  return tiers;
}

// pool: [{id, category}]; schedule: {date: [ids]}. Returns a new schedule: the existing days unchanged plus every
// missing day from `today` through today + days. Throws when the pool cannot fill a day.
export function extendSchedule(pool, schedule, { today, days = DAYS_AHEAD, runtime = [], retired = [] }) {
  const out = { ...schedule };
  const tiers = difficultyTiers(runtime);
  const blocked = new Set(retired);
  const categoryOf = new Map(pool.map((i) => [i.id, i.category]));
  const byCategory = new Map();
  for (const it of pool) if (!blocked.has(it.id)) byCategory.set(it.category, [...(byCategory.get(it.category) ?? []), it.id]);
  const uses = new Map(); // id -> dates scheduled (existing and new days)
  const use = (date, ids) => { for (const id of ids) uses.set(id, [...(uses.get(id) ?? []), date]); };
  for (const [date, ids] of Object.entries(out)) use(date, ids);
  const free = (id, date) => (uses.get(id) ?? []).every((d) => daysBetween(d, date) >= NO_REUSE_DAYS);
  const lastCategoryUse = new Map(); // category -> latest earlier day it appeared on
  const categoryCount = new Map(); // category -> days it appeared on so far

  const end = addDays(today, days);
  const first = Object.keys(out).sort()[0];
  for (let date = first && first < today ? first : today; date <= end; date = addDays(date, 1)) {
    if (!out[date] && date >= today) {
      const rand = seeded(date);
      const order = [...byCategory.keys()]
        .map((c) => ({ c, last: lastCategoryUse.get(c) ?? '', n: categoryCount.get(c) ?? 0, r: rand() }))
        .sort((a, b) => (a.last < b.last ? -1 : a.last > b.last ? 1 : a.n - b.n || a.r - b.r)); // least recent, then least used
      const picked = [];
      for (const { c } of order) {
        if (picked.length === PER_DAY) break;
        const candidates = byCategory.get(c).filter((id) => free(id, date));
        if (!candidates.length) continue;
        const want = tiers.size ? MIX[picked.length] : null;
        const matching = candidates.filter((id) => tiers.get(id) === want);
        const preferred = matching.length ? matching : candidates;
        const fresh = preferred.filter((id) => !uses.has(id)); // never used before beats used long ago
        const choices = fresh.length ? fresh : preferred;
        picked.push(choices[Math.floor(rand() * choices.length)]);
      }
      if (picked.length < PER_DAY) throw new Error(`pool too small: only ${picked.length} categories have an unused item for ${date}`);
      out[date] = picked;
      use(date, picked);
    }
    for (const id of out[date] ?? []) {
      const c = categoryOf.get(id);
      lastCategoryUse.set(c, date);
      categoryCount.set(c, (categoryCount.get(c) ?? 0) + 1);
    }
  }
  return Object.fromEntries(Object.entries(out).sort(([a], [b]) => (a < b ? -1 : 1)));
}

// One line per day, so a swap during the nightly review is a one-line edit.
export const formatSchedule = (s) => `{\n${Object.entries(s).map(([d, ids]) => `  ${JSON.stringify(d)}: ${JSON.stringify(ids).replace(/,/g, ', ')}`).join(',\n')}\n}\n`;

// wrangler d1 execute --json prints [{results: [...]}]; a plain array of rows works too.
export const runtimeRows = (json) => (Array.isArray(json) && json[0]?.results ? json[0].results : json);

function main() {
  const root = new URL('../../', import.meta.url);
  const read = (path, fallback) => (existsSync(new URL(path, root)) ? JSON.parse(readFileSync(new URL(path, root), 'utf8')) : fallback);
  const pool = read('items/pool.json', { items: [] }).items;
  const schedule = read('daily/schedule.json', {});
  const runtime = runtimeRows(read('daily/runtime.json', []));
  const next = extendSchedule(pool, schedule, { today: todayUTC(), runtime, retired: runtime.filter((r) => r.retired_at).map((r) => r.item_id) });
  writeFileSync(new URL('daily/schedule.json', root), formatSchedule(next));
  const dates = Object.keys(next);
  console.log(`schedule: ${dates.length - Object.keys(schedule).length} days added, ${dates.length} in total, ${dates[0]} to ${dates.at(-1)}${runtime.length ? ' (difficulty mix from daily/runtime.json)' : ' (category rotation)'}`);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  try {
    main();
  } catch (e) {
    console.error(`schedule: ${e.message}`);
    process.exit(1);
  }
}
