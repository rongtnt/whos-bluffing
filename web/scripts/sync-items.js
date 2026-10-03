// Validates items/items.json (the single source of truth) and copies it to the two generated, git-ignored copies:
// web/public/items.json (browser) and web/functions/_items.json (API). Never hand-edit the copies.
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

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
  for (const lang of ['en', 'zh']) {
    const q = it[lang] ?? {};
    if (!text(q.prompt)) errs.push(`missing ${lang}.prompt`);
    if (it.type === 'interval' && !text(q.unit)) errs.push(`missing ${lang}.unit`);
    if (it.type !== 'interval' && !(Array.isArray(q.options) && q.options.length === 2 && q.options.every(text))) {
      errs.push(`${lang}.options must be two strings`);
    }
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

function main() {
  const bank = JSON.parse(readFileSync(new URL('items/items.json', ROOT), 'utf8'));
  const errs = validateBank(bank);
  if (errs.length) {
    console.error(`items/items.json is invalid:\n${errs.join('\n')}`);
    process.exit(1);
  }
  const out = JSON.stringify(bank);
  for (const dest of ['web/public/items.json', 'web/functions/_items.json']) writeFileSync(new URL(dest, ROOT), out);
  const n = (t) => bank.items.filter((i) => i.type === t).length;
  console.log(`synced items v${bank.version}: ${n('2afc')} two-alternative, ${n('interval')} interval, ${n('attention')} attention`);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) main();
