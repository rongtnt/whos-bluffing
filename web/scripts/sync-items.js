// Validates the item sources and writes the generated, git-ignored copies (never hand-edit them):
//   items/items.json    -> web/public/items.json, web/functions/_items.json   (full assessment, English only)
//   items/pool.json     -> web/public/pool.json (prompts only: no answers, no sources) and web/functions/_pool.json
//   daily/schedule.json -> web/functions/_schedule.json                         (daily game)
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { isDate } from '../functions/_daily.js';

const ROOT = new URL('../../', import.meta.url);
const TYPES = ['2afc', 'interval', 'attention'];
const DOMAINS = ['physics', 'biology', 'geography', 'history', 'math', 'everyday'];
const LEVELS = ['easy', 'medium', 'hard'];
const MIN = { '2afc': 12, interval: 6 }; // one session needs this many; attention needs exactly 2

const text = (x) => typeof x === 'string' && x.trim() !== '';

function itemErrors(it) {
  const errs = [];
  if (!/^[a-z][0-9]{3}$/.test(it.id ?? '')) errs.push('bad id');
  if (!TYPES.includes(it.type)) errs.push('bad type');
  if (!DOMAINS.includes(it.domain)) errs.push('bad domain');
  if (!LEVELS.includes(it.difficulty_hint)) errs.push('bad difficulty_hint');
  if (!text(it.source)) errs.push('missing source');
  const q = it.en ?? {};
  if (!text(q.prompt)) errs.push('missing en.prompt');
  if (it.type === 'interval' && !text(q.unit)) errs.push('missing en.unit');
  if (it.type !== 'interval' && !(Array.isArray(q.options) && q.options.length === 2 && q.options.every(text))) {
    errs.push('en.options must be two strings');
  }
  if (it.type === 'interval') {
    const [lo, hi] = Array.isArray(it.accept) ? it.accept : [];
    if (!Number.isFinite(it.answer)) errs.push('answer must be a number');
    else if (!(lo <= it.answer && it.answer <= hi)) errs.push('accept must be [low, high] around the answer');
  } else if (it.answer !== 0 && it.answer !== 1) {
    errs.push('answer must be 0 or 1');
  }
  return errs.map((e) => `${it.id ?? '?'}: ${e}`);
}

// Returns a list of problems; empty means the bank is usable by the web test.
export function validateBank(bank) {
  if (!Number.isInteger(bank?.version) || !Array.isArray(bank?.items)) return ['bank needs integer version and items array'];
  const errs = bank.items.flatMap(itemErrors);
  const ids = bank.items.map((i) => i.id);
  const dupes = ids.filter((id, i) => ids.indexOf(id) !== i);
  if (dupes.length) errs.push(`duplicate ids: ${dupes.join(', ')}`);
  const count = (t) => bank.items.filter((i) => i.type === t).length;
  for (const [t, n] of Object.entries(MIN)) if (count(t) < n) errs.push(`need at least ${n} ${t} items`);
  if (count('attention') !== 2) errs.push('need exactly 2 attention items');
  return errs;
}

const POOL_DOMAINS = new Set(DOMAINS);

// Problems with the daily pool (items/pool.json); empty means usable.
export function validatePool(pool) {
  if (!Array.isArray(pool?.items)) return ['pool needs an items array'];
  const errs = [];
  const ids = new Set();
  for (const it of pool.items) {
    const e = (msg) => errs.push(`${it.id ?? '?'}: ${msg}`);
    if (!/^w[0-9]{4}$/.test(it.id ?? '')) e('bad id');
    else if (ids.has(it.id)) e('duplicate id');
    ids.add(it.id);
    if (it.type !== 'interval') e('type must be interval');
    if (!text(it.category)) e('missing category');
    if (!POOL_DOMAINS.has(it.domain)) e('bad domain');
    if (!text(it.en?.prompt) || !text(it.en?.unit)) e('missing en.prompt or en.unit');
    const [lo, hi] = Array.isArray(it.accept) ? it.accept : [];
    if (!Number.isFinite(it.answer)) e('answer must be a number');
    else if (!(lo <= it.answer && it.answer <= hi)) e('accept must be [low, high] around the answer');
    if (!/^https:\/\/[^ ]+$/.test(it.source ?? '')) e('source must be an https URL (Wikidata statement link or an authoritative reference)');
  }
  return errs;
}

// Problems with daily/schedule.json against the pool's ids; empty means usable.
export function validateSchedule(schedule, ids) {
  const errs = [];
  for (const [date, day] of Object.entries(schedule)) {
    if (!isDate(date)) errs.push(`${date}: bad date`);
    if (!Array.isArray(day) || day.length !== 5 || new Set(day).size !== 5) errs.push(`${date}: needs 5 different item ids`);
    else for (const id of day) if (!ids.has(id)) errs.push(`${date}: ${id} is not in items/pool.json`);
  }
  return errs;
}

// The browser copy of the pool: prompts only. Answers and sources (a Wikidata link shows the answer) stay server-side.
export const publicPool = (pool) => ({
  version: pool.version, items: pool.items.map((i) => ({ id: i.id, category: i.category, prompt: i.en.prompt, unit: i.en.unit })),
});

function readOptional(path, fallback) {
  if (existsSync(new URL(path, ROOT))) return JSON.parse(readFileSync(new URL(path, ROOT), 'utf8'));
  console.warn(`warning: ${path} not found; the daily game has no items until it exists (see web/README.md)`);
  return fallback;
}

function fail(file, errs) {
  console.error(`${file} is invalid:\n${errs.slice(0, 20).join('\n')}${errs.length > 20 ? `\n… and ${errs.length - 20} more` : ''}`);
  process.exit(1);
}

function main() {
  const bank = JSON.parse(readFileSync(new URL('items/items.json', ROOT), 'utf8'));
  const errs = validateBank(bank);
  if (errs.length) fail('items/items.json', errs);
  const pool = readOptional('items/pool.json', { version: 1, items: [] });
  const poolErrs = validatePool(pool);
  if (poolErrs.length) fail('items/pool.json', poolErrs);
  const schedule = readOptional('daily/schedule.json', {});
  const scheduleErrs = validateSchedule(schedule, new Set(pool.items.map((i) => i.id)));
  if (scheduleErrs.length) fail('daily/schedule.json', scheduleErrs);

  // English only: the zh fields stay in items/items.json (repo checks read them) but are never shipped.
  const out = JSON.stringify({ ...bank, items: bank.items.map(({ zh, ...it }) => it) });
  for (const dest of ['web/public/items.json', 'web/functions/_items.json']) writeFileSync(new URL(dest, ROOT), out);
  writeFileSync(new URL('web/public/pool.json', ROOT), JSON.stringify(publicPool(pool)));
  writeFileSync(new URL('web/functions/_pool.json', ROOT), JSON.stringify(pool));
  writeFileSync(new URL('web/functions/_schedule.json', ROOT), JSON.stringify(schedule));
  const n = (t) => bank.items.filter((i) => i.type === t).length;
  const days = Object.keys(schedule).sort();
  console.log(`synced items v${bank.version}: ${n('2afc')} two-alternative, ${n('interval')} interval, ${n('attention')} attention; `
    + `pool ${pool.items.length} items; schedule ${days.length} days${days.length ? ` (${days[0]} to ${days.at(-1)})` : ''}`);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) main();
