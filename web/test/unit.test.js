// Unit tests for the non-metric logic: item bank, session builder, request validation, i18n, card text wrap,
// class aggregates. HTTP behaviour is covered by test/smoke.sh.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { validateBank } from '../scripts/sync-items.js';
import { buildSession, pickBalanced } from '../public/test.js';
import { validateSubmit, DEMOGRAPHICS } from '../functions/_util.js';
import { wrap } from '../public/share.js';
import { html } from '../public/ui.js';
import { classAggregate, toCsv } from '../functions/api/class/d/[secret].js';

const read = (p) => JSON.parse(readFileSync(new URL(p, import.meta.url), 'utf8'));
const bank = read('../../items/items.json');
const items = bank.items;
const ITEMS = new Map(items.map((i) => [i.id, i]));
const en = read('../public/i18n/en.json');
const zh = read('../public/i18n/zh.json');

// Deterministic PRNG so failures reproduce.
function seeded(seed) {
  let s = seed;
  return () => ((s = (s * 1103515245 + 12345) % 2147483648) / 2147483648);
}

test('item bank: valid, 40/20/2, every domain has enough items for two balanced sessions', () => {
  assert.deepEqual(validateBank(bank), []);
  const of = (t) => items.filter((i) => i.type === t);
  assert.equal(of('2afc').length, 40);
  assert.equal(of('interval').length, 20);
  assert.equal(of('attention').length, 2);
  const domains = ['physics', 'biology', 'geography', 'history', 'math', 'everyday'];
  for (const d of domains) {
    assert.ok(of('2afc').filter((i) => i.domain === d).length >= 4, `2afc ${d}`);
    assert.ok(of('interval').filter((i) => i.domain === d).length >= 2, `interval ${d}`);
  }
  for (const level of ['easy', 'medium', 'hard']) {
    const share = items.filter((i) => i.type !== 'attention' && i.difficulty_hint === level).length / 60;
    assert.ok(share > 0.25 && share < 0.42, `${level} share ${share}`);
  }
});

test('item bank validator rejects broken items', () => {
  const broken = (patch) => validateBank({ version: 1, items: items.map((i) => (i.id === 'r001' ? { ...i, ...patch } : i)) });
  assert.match(broken({ accept: [6000, 9000] }).join(), /accept/);
  assert.match(broken({ source: '' }).join(), /source/);
  assert.match(broken({ id: 'R1' }).join(), /bad id/);
  assert.match(validateBank({ version: 1, items: items.filter((i) => i.type !== 'attention') }).join(), /attention/);
});

test('buildSession: 12 + 6 + 2, balanced 2 per domain, attention at positions 5–15, no duplicates', () => {
  for (let seed = 1; seed <= 200; seed += 1) {
    const s = buildSession(items, new Set(), seeded(seed));
    assert.equal(s.length, 20);
    assert.equal(new Set(s.map((i) => i.id)).size, 20);
    const two = s.filter((i) => i.type === '2afc');
    assert.equal(two.length, 12);
    assert.equal(s.filter((i) => i.type === 'interval').length, 6);
    const perDomain = Object.values(Object.groupBy(two, (i) => i.domain)).map((g) => g.length);
    assert.deepEqual(perDomain, [2, 2, 2, 2, 2, 2]);
    const positions = s.map((i, k) => (i.type === 'attention' ? k + 1 : null)).filter(Boolean);
    assert.equal(positions.length, 2);
    for (const p of positions) assert.ok(p >= 5 && p <= 15, `attention at ${p}`);
  }
});

test('buildSession: second run avoids seen items but keeps both attention checks', () => {
  const first = buildSession(items, new Set(), seeded(7));
  const seen = new Set(first.map((i) => i.id));
  const second = buildSession(items, seen, seeded(8));
  const repeats = second.filter((i) => seen.has(i.id)).map((i) => i.type);
  assert.deepEqual(repeats.sort(), ['attention', 'attention']);
});

test('pickBalanced falls back to the whole pool when too few unseen items remain', () => {
  const pool = items.filter((i) => i.type === 'interval');
  const seen = new Set(pool.slice(0, 18).map((i) => i.id));
  const picked = pickBalanced(pool, 6, seen, seeded(3));
  assert.equal(picked.length, 6);
  assert.equal(new Set(picked.map((i) => i.id)).size, 6);
});

function validBody() {
  const of = (t, n) => items.filter((i) => i.type === t).slice(0, n);
  return {
    lang: 'en',
    website: '',
    answers: [
      ...of('2afc', 12).map((i) => ({ id: i.id, choice: 1, conf: 80, rt_ms: 2000 })),
      ...of('interval', 6).map((i) => ({ id: i.id, low: 1, high: 2, rt_ms: 3000 })),
      ...of('attention', 2).map((i) => ({ id: i.id, choice: i.answer, conf: 100, rt_ms: 1000 })),
    ],
  };
}

test('validateSubmit accepts a complete session and rejects each kind of bad input', () => {
  assert.equal(validateSubmit(validBody(), ITEMS), null);
  assert.equal(validateSubmit({ ...validBody(), class_code: 'ABC234', first_session_id: crypto.randomUUID(), demographics: { age: '18_24', region: 'europe' } }, ITEMS), null);
  const bad = (mutate) => { const b = validBody(); mutate(b); return validateSubmit(b, ITEMS); };
  assert.match(bad((b) => { b.lang = 'fr'; }), /lang/);
  assert.match(bad((b) => { b.answers[0].conf = 55; }), /conf/);
  assert.match(bad((b) => { b.answers[0].choice = 2; }), /choice/);
  assert.match(bad((b) => { b.answers[12].low = 5; }), /range/);
  assert.match(bad((b) => { b.answers[12].high = Infinity; }), /range/);
  assert.match(bad((b) => { b.answers[0].rt_ms = -1; }), /rt_ms/);
  assert.match(bad((b) => { b.answers[0].id = 'x999'; }), /unknown item/);
  assert.match(bad((b) => { b.answers[1].id = b.answers[0].id; }), /duplicate/);
  assert.match(bad((b) => { b.answers.pop(); }), /expected 2 attention/);
  assert.match(bad((b) => { b.class_code = 'abc'; }), /class_code/);
  assert.match(bad((b) => { b.first_session_id = 'nope'; }), /first_session_id/);
  assert.match(bad((b) => { b.demographics = { age: '99' }; }), /age/);
  assert.match(bad((b) => { b.demographics = { email: 'x' }; }), /unknown demographic/);
  assert.match(validateSubmit([], ITEMS), /object/);
  // Out-of-bounds ranges are analysis-time exclusions, not rejections.
  assert.equal(bad((b) => { b.answers[12].low = -1e9; b.answers[12].high = 1e12; }), null);
});

function keyPaths(o, prefix = '') {
  return Object.entries(o).flatMap(([k, v]) => (typeof v === 'object' ? keyPaths(v, `${prefix}${k}.`) : [`${prefix}${k}`]));
}
const placeholders = (s) => (s.match(/\{\w+\}/g) ?? []).sort().join();
const at = (o, path) => path.split('.').reduce((x, k) => x[k], o);

test('i18n: en and zh have the same keys and placeholders; demographic codes match the API', () => {
  assert.deepEqual(keyPaths(zh).sort(), keyPaths(en).sort());
  for (const p of keyPaths(en)) assert.equal(placeholders(at(zh, p)), placeholders(at(en, p)), p);
  for (const [field, codes] of Object.entries(DEMOGRAPHICS)) {
    assert.deepEqual(Object.keys(en.demo.options[field]), codes, `en ${field}`);
    assert.deepEqual(Object.keys(zh.demo.options[field]), codes, `zh ${field}`);
  }
});

test('i18n: consent and headline copy match the brief', () => {
  assert.equal(en.landing.consent, '5 minutes. Anonymous — no account, no tracking. Your answers go into a public research dataset. Close the page any time to stop.');
  assert.equal(zh.landing.consent, '5 分钟。匿名，不用注册，不追踪。你的答案会进入一个公开的研究数据集。随时关掉页面即可退出。');
  const fill = (s, v) => s.replace(/\{(\w+)\}/g, (_, k) => v[k]);
  assert.equal(fill(en.results.int_headline, { k: 4, n: 6 }), 'Your 90% ranges were right 4 of 6 times.');
  assert.equal(fill(zh.results.int_headline, { k: 4, n: 6 }), '你给的 90% 范围，6 次里有 4 次包含真实答案。');
  assert.equal(fill(en.results.over_headline, { x: 12 }), 'You were 12 points more confident than you were right.');
  assert.equal(fill(zh.results.over_headline, { x: 12 }), '你的信心比你的正确率高了 12 个百分点。');
});

test('html template escapes interpolated text but not nested templates', () => {
  const label = '<img src=x onerror=alert(1)>';
  assert.equal(String(html`<p>${label}</p>`), '<p>&lt;img src=x onerror=alert(1)&gt;</p>');
  assert.equal(String(html`<ul>${['a', 'b'].map((x) => html`<li>${x}</li>`)}</ul>`), '<ul><li>a</li><li>b</li></ul>');
});

test('wrap: words for English, characters for Chinese, punctuation never starts a line', () => {
  const measure = (s) => [...s].length; // one unit per character
  assert.deepEqual(wrap('Your 90% ranges were right', 12, measure), ['Your 90%', 'ranges were', 'right']);
  const zhLines = wrap('你给的 90% 范围，6 次里有', 7, measure);
  assert.ok(zhLines.every((l) => !/^[，。]/.test(l)), zhLines.join('|'));
  assert.equal(zhLines.join('').replace(/\s/g, ''), '你给的90%范围，6次里有');
  assert.deepEqual(wrap('', 10, measure), []);
});

function fakeEnv(rows, secretKnown = true) {
  const stmt = (sql) => ({
    bind: () => ({
      first: async () => (sql.includes('FROM classes') && secretKnown ? { code: 'ABC234' } : null),
      all: async () => ({ results: rows }),
    }),
  });
  return { DB: { prepare: stmt } };
}
const row = (overconf, int_hit, answers) => ({ overconf, int_hit, answers: JSON.stringify(answers) });
const SECRET = 'A'.repeat(24);

test('class dashboard: only the count below 5 students, aggregates from 5, never rows', async () => {
  const answers = [{ type: '2afc', conf: 80, correct: 1 }, { type: '2afc', conf: 80, correct: 0 }, { type: 'interval', hit: 1 }];
  const four = [0.1, 0.2, 0.3, -0.1].map((oc) => row(oc, 0.5, answers));
  assert.deepEqual(await classAggregate(fakeEnv(four), SECRET), { n: 4 });
  const five = [...four, row(0.45, 1, answers)];
  const agg = await classAggregate(fakeEnv(five), SECRET);
  assert.deepEqual(Object.keys(agg).sort(), ['bins', 'int_hit_mean', 'n', 'overconf_hist', 'overconf_mean']);
  assert.equal(agg.n, 5);
  assert.equal(agg.overconf_mean, 0.19);
  assert.equal(agg.int_hit_mean, 0.6);
  assert.deepEqual(agg.bins.find((b) => b.conf === 0.8), { conf: 0.8, n: 10, acc: 0.5 });
  assert.equal(agg.overconf_hist.reduce((s, h) => s + h.n, 0), 5);
  assert.equal(agg.overconf_hist.find((h) => h.from === 40).n, 1); // 0.45 -> 40..50
  assert.equal(agg.overconf_hist.find((h) => h.from === -10).n, 1); // -0.1 -> -10..0
  assert.match(toCsv(agg), /^metric,bucket,n,value\nstudents,,5,\n/);
  assert.equal(toCsv({ n: 3 }), 'metric,bucket,n,value\nstudents,,3,\n');
  assert.equal(await classAggregate(fakeEnv(five, false), SECRET), null);
  assert.equal(await classAggregate(fakeEnv(five), 'short'), null);
});
