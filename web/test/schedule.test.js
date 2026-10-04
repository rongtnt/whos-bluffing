// Schedule generator (scripts/schedule.js), nightly review print (scripts/tomorrow.js), and the pool/schedule checks
// in scripts/sync-items.js, on synthetic pools and on the real items/pool.json + daily/schedule.json.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { extendSchedule, formatSchedule, difficultyTiers, runtimeRows, NO_REUSE_DAYS } from '../scripts/schedule.js';
import { review, reviewRounds } from '../scripts/tomorrow.js';
import { validatePool, validateSchedule, publicPool } from '../scripts/sync-items.js';
import { addDays, EPOCH } from '../functions/_daily.js';

const read = (p) => JSON.parse(readFileSync(new URL(p, import.meta.url), 'utf8'));
const DAY_MS = 86400000;
const gap = (a, b) => Math.abs(Date.parse(a) - Date.parse(b)) / DAY_MS;

function makePool(categories, perCategory) {
  const items = [];
  for (let c = 0; c < categories; c += 1) {
    for (let k = 0; k < perCategory; k += 1) items.push({ id: `w${String(items.length + 1).padStart(4, '0')}`, category: `cat${c}` });
  }
  return items;
}

// Every day: 5 different items from 5 different categories; no item twice within NO_REUSE_DAYS.
function assertRules(pool, schedule) {
  const category = new Map(pool.map((i) => [i.id, i.category]));
  const uses = new Map();
  for (const [date, ids] of Object.entries(schedule)) {
    assert.equal(ids.length, 5, date);
    assert.equal(new Set(ids.map((id) => category.get(id))).size, 5, `${date}: categories ${ids.map((id) => category.get(id))}`);
    for (const id of ids) uses.set(id, [...(uses.get(id) ?? []), date]);
  }
  for (const [id, dates] of uses) {
    dates.sort();
    for (let k = 1; k < dates.length; k += 1) assert.ok(gap(dates[k - 1], dates[k]) >= NO_REUSE_DAYS, `${id} reused ${dates[k - 1]} -> ${dates[k]}`);
  }
  return uses;
}

test('schedule: fills today..today+120 with 5 items in 5 categories, deterministic, rotating categories', () => {
  const pool = makePool(8, 120);
  const s = extendSchedule(pool, {}, { today: '2026-10-20' });
  const dates = Object.keys(s);
  assert.equal(dates.length, 121);
  assert.deepEqual([dates[0], dates.at(-1)], ['2026-10-20', '2027-02-17']);
  assertRules(pool, s);
  assert.deepEqual(extendSchedule(pool, {}, { today: '2026-10-20' }), s); // same inputs, same days
  const perCategory = {};
  for (const ids of Object.values(s)) for (const id of ids) perCategory[pool.find((i) => i.id === id).category] = (perCategory[pool.find((i) => i.id === id).category] ?? 0) + 1;
  const counts = Object.values(perCategory);
  assert.ok(Math.max(...counts) - Math.min(...counts) <= 2, `rotation is even: ${counts}`); // 605 slots / 8 categories
});

test('schedule: existing days are never changed (past or hand-edited future) and count for the 180-day rule', () => {
  const pool = makePool(8, 120);
  const handEdited = { '2026-10-01': ['w0001', 'w0121', 'w0241', 'w0361', 'w0481'], '2026-11-05': ['w0002', 'w0122', 'w0242', 'w0362', 'w0482'] };
  const s = extendSchedule(pool, handEdited, { today: '2026-10-20', days: 30 });
  assert.deepEqual(s['2026-10-01'], handEdited['2026-10-01']);
  assert.deepEqual(s['2026-11-05'], handEdited['2026-11-05']);
  assert.equal(Object.keys(s).length, 2 + 30); // 10-20..11-19 minus the existing 11-05, plus both existing days
  assertRules(pool, s);
  const again = extendSchedule(pool, s, { today: '2026-10-25', days: 30 });
  for (const [date, ids] of Object.entries(s)) assert.deepEqual(again[date], ids, date); // re-running only appends
  assert.equal(Object.keys(again).length, Object.keys(s).length + 5);
});

test('schedule: items come back only after 180 days; a pool too small to fill a day is an error', () => {
  const pool = makePool(8, 125); // 1,000 items: enough for 180 days, then reuse
  const s = extendSchedule(pool, {}, { today: '2026-10-20', days: 260 });
  const uses = assertRules(pool, s);
  assert.ok([...uses.values()].some((d) => d.length > 1), 'some items are reused after 180 days');
  assert.throws(() => extendSchedule(makePool(6, 30), {}, { today: '2026-10-20' }), /pool too small: only \d categories have an unused item for 2026-1/);
  assert.throws(() => extendSchedule(makePool(4, 500), {}, { today: '2026-10-20' }), /pool too small: only 4 categories/);
});

test('schedule: difficulty mix from runtime data; retired items never scheduled', () => {
  const pool = makePool(6, 60);
  const tierOf = (n) => ['easy', 'medium', 'hard'][n % 3];
  const hits = { easy: 40, medium: 28, hard: 10 };
  const runtime = pool.map((it, n) => ({ item_id: it.id, n_answers: 50, n_hits: hits[tierOf(n)] }));
  assert.equal(difficultyTiers(runtime).get('w0001'), 'easy');
  assert.equal(difficultyTiers([{ item_id: 'x', n_answers: 29, n_hits: 29 }]).size, 0); // too few answers
  const retired = pool.filter((_, n) => n % 10 === 0).map((i) => i.id);
  const s = extendSchedule(pool, {}, { today: '2026-10-20', days: 20, runtime, retired });
  assertRules(pool, s);
  const tiers = difficultyTiers(runtime);
  for (const [date, ids] of Object.entries(s)) {
    assert.deepEqual(ids.map((id) => tiers.get(id)), ['easy', 'medium', 'hard', 'medium', 'easy'], date);
    for (const id of ids) assert.ok(!retired.includes(id), `${id} is retired`);
  }
  assert.deepEqual(runtimeRows([{ results: [{ item_id: 'w1' }], success: true }]), [{ item_id: 'w1' }]); // wrangler --json shape
  assert.deepEqual(runtimeRows([{ item_id: 'w1' }]), [{ item_id: 'w1' }]);
});

test('schedule file: one line per day, parses back unchanged', () => {
  const s = { '2026-10-20': ['w0001', 'w0002', 'w0003', 'w0004', 'w0005'], '2026-10-21': ['w0006', 'w0007', 'w0008', 'w0009', 'w0010'] };
  const text = formatSchedule(s);
  assert.equal(text, '{\n  "2026-10-20": ["w0001", "w0002", "w0003", "w0004", "w0005"],\n  "2026-10-21": ["w0006", "w0007", "w0008", "w0009", "w0010"]\n}\n');
  assert.deepEqual(JSON.parse(text), s);
});

// The live files get the checks sync-items enforces, not the generator's rules: hand-curated days may repeat a
// category or an item, and future curation must not break the tests (the rules are tested above on fixtures).
test('the real pool and schedule pass the sync checks; the browser copy has no answers or sources', () => {
  const pool = read('../../items/pool.json');
  const schedule = read('../../daily/schedule.json');
  assert.deepEqual(validatePool(pool), []);
  assert.ok(pool.items.length >= 1500 && pool.items.length <= 4000, `pool size ${pool.items.length}`); // 3,261 with the relatable categories
  assert.deepEqual(validateSchedule(schedule, new Set(pool.items.map((i) => i.id))), []);
  const pub = read('../public/pool.json');
  assert.deepEqual(pub, publicPool(pool));
  assert.deepEqual(Object.keys(pub.items[0]).sort(), ['category', 'id', 'prompt', 'unit']);
  assert.ok(!/"answer"|"source"|wikidata|"accept"/.test(JSON.stringify(pub)));
  assert.deepEqual(read('../functions/_schedule.json'), schedule);
});

test('pool and schedule validators catch broken entries', () => {
  const good = { id: 'w0001', type: 'interval', category: 'river_length', domain: 'geography', en: { prompt: 'How long?', unit: 'km' },
    answer: 6650, accept: [1, 8000], source: 'https://www.wikidata.org/wiki/Q3392#P2043' };
  assert.deepEqual(validatePool({ items: [good] }), []);
  const bad = (patch) => validatePool({ items: [{ ...good, ...patch }] }).join();
  assert.match(bad({ id: 'w1' }), /bad id/);
  assert.match(bad({ accept: [7000, 8000] }), /accept/);
  assert.match(bad({ source: 'wikidata Q3392 (not a URL)' }), /source/);
  assert.match(bad({ en: { prompt: 'x' } }), /unit/);
  assert.match(validatePool({ items: [good, good] }).join(), /duplicate/);
  const ids = new Set(['w0001', 'w0002', 'w0003', 'w0004', 'w0005']);
  assert.deepEqual(validateSchedule({ '2026-10-20': [...ids] }, ids), []);
  assert.match(validateSchedule({ '2026-10-20': ['w0001', 'w0002', 'w0003', 'w0004'] }, ids).join(), /5 different/);
  assert.match(validateSchedule({ '2026-10-20': ['w0001', 'w0002', 'w0003', 'w0004', 'w9999'] }, ids).join(), /w9999 is not in/);
  assert.match(validateSchedule({ '2026-02-30': [...ids] }, ids).join(), /bad date/);
});

test('nightly review print (npm run tomorrow): the ranked ten and the chat question, both values and both sources', () => {
  const pool = [
    { id: 'w0001', category: 'river_length', name: 'the Nile', en: { prompt: 'x', unit: 'km' }, answer: 6650, source: 'https://www.wikidata.org/wiki/Q3392#P2043' },
    { id: 'w0002', category: 'river_length', name: 'the Danube', en: { prompt: 'x', unit: 'km' }, answer: 2850, source: 'https://www.wikidata.org/wiki/Q1653#P2043' },
    { id: 'w0003', category: 'first_flight', name: 'the Concorde', en: { prompt: 'x', unit: 'year' }, answer: 1969, source: 'https://www.wikidata.org/wiki/Q6482#P606' },
    { id: 'w0004', category: 'first_flight', name: 'the Boeing 787', en: { prompt: 'x', unit: 'year' }, answer: 2009, source: 'https://www.wikidata.org/wiki/Q399#P606' },
  ];
  const pairs = [
    { id: 'p00001', a_id: 'w0002', b_id: 'w0001', truth: 1, prompt: 'Which is longer?', category: 'river_length', difficulty_hint: 'medium' },
    { id: 'p00002', a_id: 'w0003', b_id: 'w0004', truth: 0, prompt: 'Which came first?', category: 'first_flight', difficulty_hint: 'easy' },
  ];
  const text = reviewRounds(pool, pairs, { '2026-10-20': { ranked: ['p00001'], question: 'p00002' } }, '2026-10-20');
  assert.ok(text.startsWith("Who's Bluffing? ranked round · 2026-10-20 (UTC)\n"), text);
  assert.match(text, /1\. p00001 \[river_length, medium\] Which is longer\?\n {3}A the Danube: 2,850 km · https:\/\/www\.wikidata\.org\/wiki\/Q1653#P2043\n {3}B the Nile: 6,650 km · https:\/\/www\.wikidata\.org\/wiki\/Q3392#P2043\n {3}answer: B \(the Nile\)/);
  assert.match(text, /Slack and Discord question of the day:\nQ\. p00002 \[first_flight, easy\] Which came first\?\n {3}A the Concorde: 1969 · /);
  assert.throws(() => reviewRounds(pool, pairs, {}, '2026-10-21'), /no ranked round for 2026-10-21/);
  assert.throws(() => reviewRounds(pool, pairs, { '2026-10-20': { ranked: ['p00009'], question: 'p00002' } }, '2026-10-20'), /p00009/);
});

test('legacy daily review print: number (#0 before launch), date, answers with units (years without separators), sources', () => {
  const pool = [
    { id: 'w0001', category: 'bridge_length', en: { prompt: 'How long is the Mackinac Bridge?', unit: 'm' }, answer: 8038, source: 'https://www.wikidata.org/wiki/Q12568#P2043' },
    { id: 'w0002', category: 'first_ascent', en: { prompt: 'In what year was K2 first climbed?', unit: 'year' }, answer: 1954, source: 'https://www.wikidata.org/wiki/Q43512#P793' },
  ];
  const day2 = addDays(EPOCH, 1);
  const text = review(pool, { [day2]: ['w0001', 'w0002'] }, day2);
  assert.ok(text.startsWith(`Who's Bluffing? #2 · ${day2} (UTC)\n`), text);
  assert.match(text, /1\. w0001 \[bridge_length\] How long is the Mackinac Bridge\?\n {3}answer: 8,038 m\n {3}source: https:\/\/www\.wikidata\.org\/wiki\/Q12568#P2043/);
  assert.match(text, /answer: 1954\n/);
  const preview = addDays(EPOCH, -5);
  assert.ok(review(pool, { [preview]: ['w0002'] }, preview).startsWith(`Who's Bluffing? #0 · ${preview} (UTC)\n`));
  assert.throws(() => review(pool, {}, '2026-10-22'), /nothing scheduled for 2026-10-22/);
  assert.throws(() => review(pool, { '2026-10-22': ['w0009'] }, '2026-10-22'), /w0009/);
  assert.equal(addDays('2026-10-20', 1), '2026-10-21');
});
