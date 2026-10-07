import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { openD1 } from './d1.js';
import { loadRounds, getRound, answer, complete, flagPair, pairView, DIFFICULTIES } from '../functions/_rounds.js';
import { claimSide } from '../functions/_labs.js';
import { validateCurated } from '../scripts/sync-items.js';
import { detailCard } from '../public/round-end.js';
import { playResult } from '../../discord/src/game.js';

const json = (p) => JSON.parse(readFileSync(new URL(p, import.meta.url), 'utf8'));
const bank = json('../../items/quick_curated.json');
const pool = json('../functions/_pool.json'), pairs = json('../functions/_pairs.json'), days = json('../functions/_rounds.json');
const data = loadRounds(pool, pairs, days, { curated: bank.items });
const now = new Date('2026-10-05T12:00:00Z');
const seeded = (seed) => () => ((seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0) / 2 ** 32);
const who = 'curated-player-123456789';
const meta = (id) => {
  const p = data.pairs.get(id), a = data.items.get(p.a_id);
  return { ...p, topic: p.topic ?? (a.category.startsWith('ai_') ? 'ai' : a.category.startsWith('country_') ? 'world' : a.category),
    family: p.family ?? (['year', 'month'].includes(a.en.unit) ? 'chronology' : 'comparison') };
};

test('authored bank: 260 short, sourced questions; rejects malformed content before bundling', () => {
  assert.deepEqual(validateCurated(bank), []);
  assert.equal(bank.items.length, 260);
  assert.equal(bank.items.filter((q) => q.topic === 'ai').length, 24);
  assert.equal(bank.items.filter((q) => q.topic === 'memes').length, 40);
  assert.equal(bank.items.filter((q) => q.answer === 0).length, 130);
  for (const patch of [{ id: 'p00001' }, { topic: 'unknown' }, { family: '' }, { difficulty: 'impossible' },
    { answer: 2 }, { options: ['same', 'same'] }, { explanation: '' }, { source: 'javascript:alert(1)' }, { source: ['https://example.com'] }]) {
    assert.ok(validateCurated({ version: 1, items: [{ ...bank.items[0], ...patch }] }).length, JSON.stringify(patch));
  }
  assert.ok(validateCurated({ version: 1, items: [null] }).length);
  assert.ok(validateCurated({ version: 1, items: [bank.items[0], bank.items[0]] }).length);
  // Arithmetic reveals are worked solutions, not estimated trivia values.
  assert.equal(100 * 1.2 * 0.8, 96);
  assert.equal(120 / (60 / 30 + 60 / 60), 40);
  assert.ok(Math.abs(1 - Array.from({ length: 23 }, (_, k) => (365 - k) / 365).reduce((a, b) => a * b) - 0.507297) < 0.000001);
});

test('900 real-bank rounds: full difficulty mix, topic and format caps, no leaked reveals, D1 binding limits', async () => {
  const db = openD1(), prepare = db.prepare;
  db.prepare = (sql) => {
    assert.ok((sql.match(/\?/g) ?? []).length <= 100, 'D1 limit: 100 bindings per statement');
    return prepare(sql);
  };
  const avoided = new Set([...days['2026-10-05'].ranked, days['2026-10-05'].question]);
  const openers = new Set();
  for (const pack of ['all', 'ai', 'memes']) for (const difficulty of Object.keys(DIFFICULTIES)) {
    for (let seed = 1; seed <= 100; seed++) {
      const r = await getRound(db, data, { mode: 'quick', pack, difficulty }, now, seeded(seed));
      assert.equal(r.status, 200, `${pack}/${difficulty}/${seed}: ${JSON.stringify(r.body)}`);
      const ids = r.body.items.map((q) => q.id), selected = ids.map(meta);
      assert.equal(new Set(ids).size, 10);
      assert.ok(!ids.some((id) => avoided.has(id)));
      assert.ok(ids.every((id) => id.startsWith('q')), 'fresh player receives authored questions');
      for (const [lv, n] of Object.entries(DIFFICULTIES[difficulty].mix)) assert.equal(selected.filter((p) => p.level === lv).length, n);
      for (const p of selected) {
        assert.ok(selected.filter((x) => x.family === p.family).length <= (p.family === 'chronology' ? 2 : 3));
        if (pack === 'all') assert.ok(selected.filter((x) => x.topic === p.topic).length <= (p.topic === 'ai' ? 1 : 2));
        else assert.equal(p.topic, pack);
      }
      assert.ok(selected.every((p, i) => !i || p.family !== selected[i - 1].family));
      if (pack === 'all') {
        assert.ok(selected.every((p) => p.topic !== 'memes'), 'Memes stays behind its own chip');
        openers.add(selected[0].topic);
        assert.equal(selected.filter((p) => p.topic === 'ai').length, 1);
        assert.ok(new Set(selected.map((p) => p.topic)).size >= 5);
      }
      if (pack === 'memes') assert.equal(new Set(selected.map((p) => p.authored.source)).size, 10, 'no meme twice in one round');
      for (const q of r.body.items) assert.deepEqual(Object.keys(q).sort(), ['a', 'b', 'id', 'prompt']);
    }
  }
  assert.ok(openers.size >= 5, 'All does not always start with the same topic');
  db.sqlite.close();
});

test('History and Languages: three consecutive rounds at every difficulty stay varied and avoid repeated questions', async () => {
  const db = openD1();
  for (const pack of ['history', 'languages']) {
    assert.equal(bank.items.filter((q) => q.topic === pack).length, 80);
    for (const difficulty of Object.keys(DIFFICULTIES)) {
      assert.ok(data.available[difficulty].has(pack));
      for (let seed = 1; seed <= 30; seed++) {
        const seen = [];
        for (let game = 0; game < 3; game++) {
          const r = await getRound(db, data, { mode: 'quick', pack, difficulty, seen: seen.join(',') }, now, seeded(seed + game));
          assert.equal(r.status, 200, `${pack}/${difficulty}/${seed}/${game}: ${JSON.stringify(r.body)}`);
          const qs = r.body.items.map((q) => data.pairs.get(q.id).authored);
          assert.ok(qs.every((q) => q.topic === pack && !seen.includes(q.id)), `${pack}/${difficulty}: no question repeats`);
          assert.ok(new Set(qs.map((q) => q.family)).size >= 4);
          assert.ok(qs.filter((q) => ['chronology', 'comparison'].includes(q.family)).length <= 2);
          for (const q of qs) assert.ok(qs.filter((p) => p.subtopic === q.subtopic).length <= 3);
          const subjects = qs.flatMap((q) => q.subjects);
          assert.equal(new Set(subjects).size, subjects.length, 'no shared subject within a round');
          if (pack === 'history') for (const field of ['era', 'region']) {
            assert.ok(new Set(qs.map((q) => q[field])).size >= 3);
            for (const q of qs) assert.ok(qs.filter((p) => p[field] === q[field]).length <= 4);
          }
          seen.push(...qs.map((q) => q.id));
        }
      }
      const exhausted = await getRound(db, data, { mode: 'quick', pack, difficulty, seen: data.curated.join(',') }, now, seeded(7));
      assert.equal(exhausted.status, 200);
      assert.ok(exhausted.body.items.every((q) => data.pairs.get(q.id).authored.topic === pack));
    }
  }
  db.sqlite.close();
});

test('all offered packs: varied comparison wording, ten distinct questions, difficulty preserved and challenge stable', async () => {
  const db = openD1();
  for (const [difficulty, packs] of Object.entries(data.available)) for (const pack of packs) {
    for (let seed = 1; seed <= 10; seed++) {
      const r = await getRound(db, data, { mode: 'quick', pack, difficulty }, now, seeded(seed));
      assert.equal(r.status, 200, `${pack}/${difficulty}/${seed}: ${JSON.stringify(r.body)}`);
      const selected = r.body.items.map((q) => data.pairs.get(q.id));
      assert.equal(new Set(r.body.items.map((q) => q.id)).size, 10);
      for (const [level, n] of Object.entries(DIFFICULTIES[difficulty].mix)) assert.equal(selected.filter((p) => p.level === level).length, n);
      assert.ok(new Set(r.body.items.map((q) => q.prompt)).size >= 2, `${pack}: varied wording`);
      assert.deepEqual((await getRound(db, data, { round_id: r.body.round_id }, now)).body, r.body);
      if (pack === 'memes') {
        await db.prepare('UPDATE rounds SET pack = NULL WHERE round_id = ?').bind(r.body.round_id).run();
        assert.deepEqual((await getRound(db, data, { round_id: r.body.round_id }, now)).body, r.body);
      }
    }
  }
  // Every generated template has alternatives; wording never changes the two choices or leaks values.
  for (const t of pairs.templates) {
    const views = [...data.pairs.values()].filter((p) => !p.authored && data.items.get(p.a_id).category === t.category && data.items.get(p.a_id).en.unit === t.unit)
      .map((p) => pairView(data, p.id));
    assert.ok(new Set(views.map((q) => q.prompt)).size >= 2, `${t.category}/${t.unit}`);
    for (const q of views) {
      const p = data.pairs.get(q.id);
      assert.equal(q.a, data.items.get(p.a_id).name);
      assert.equal(q.b, data.items.get(p.b_id).name);
      assert.deepEqual(Object.keys(q).sort(), ['a', 'b', 'id', 'prompt']);
    }
  }
  db.sqlite.close();
});

test('repeat play prefers unseen questions and still fills a round when the authored bank has been seen', async () => {
  const db = openD1();
  const first = await getRound(db, data, { mode: 'quick' }, now, seeded(42));
  const seen = first.body.items.map((q) => q.id);
  const second = await getRound(db, data, { mode: 'quick', seen: seen.join(',') }, now, seeded(42));
  assert.equal(second.status, 200);
  assert.ok(second.body.items.every((q) => !seen.includes(q.id)));
  for (const pack of ['all', 'ai', 'memes']) for (const difficulty of Object.keys(DIFFICULTIES)) {
    const r = await getRound(db, data, { mode: 'quick', pack, difficulty, seen: data.curated.join(',') }, now, seeded(4));
    assert.equal(r.status, 200, `${pack}/${difficulty}: ${JSON.stringify(r.body)}`);
    assert.equal(r.body.items.length, 10);
  }
  db.sqlite.close();
});

test('Memes availability requires a varied full round; retired questions refill without other topics', async () => {
  const empty = loadRounds(pool, pairs, days);
  const narrow = loadRounds(pool, pairs, days, { curated: bank.items.filter((q) => q.topic === 'memes').map((q) => ({ ...q, family: 'origin' })) });
  for (const d of Object.keys(DIFFICULTIES)) {
    assert.ok(!empty.available[d].has('memes'));
    assert.ok(!narrow.available[d].has('memes'));
    assert.ok(data.available[d].has('memes'));
  }
  const db = openD1();
  const r = await getRound(db, data, { mode: 'quick', pack: 'memes', difficulty: 'easy' }, now, seeded(7));
  const retired = r.body.items[0].id;
  await db.prepare('INSERT INTO pair_runtime (pair_id, retired_at) VALUES (?, ?)').bind(retired, now.toISOString()).run();
  const fresh = await getRound(db, data, { mode: 'quick', pack: 'memes', difficulty: 'easy' }, now, seeded(7));
  assert.equal(fresh.status, 200);
  assert.equal(fresh.body.items.length, 10);
  assert.ok(fresh.body.items.every((q) => q.id !== retired && meta(q.id).topic === 'memes'));
  const q = fresh.body.items[0], expected = data.pairs.get(q.id);
  const a = await answer(db, data, { round_id: fresh.body.round_id, item_id: q.id, anon_id: who, choice: expected.truth, conf: 100, surface: 'web' }, now);
  assert.equal(a.body.points, 100);
  assert.equal(a.body.truth.fun, expected.authored.explanation);
  assert.equal(a.body.truth.a_source, expected.authored.source);
  assert.deepEqual((await getRound(db, data, { round_id: fresh.body.round_id }, now)).body.items, fresh.body.items);
  db.sqlite.close();
});

test('authored answers: scoring, idempotency, reveal on web/Discord, complete, saved challenge and AI claim', async () => {
  const db = openD1();
  const r = (await getRound(db, data, { mode: 'quick', pack: 'ai' }, now, seeded(10))).body;
  const answers = {};
  for (const [k, q] of r.items.entries()) {
    const p = data.pairs.get(q.id);
    const body = { round_id: r.round_id, item_id: q.id, choice: k === 0 ? 1 - p.truth : p.truth, conf: 100,
      rt_ms: 2000, anon_id: who, surface: 'web' };
    const a = await answer(db, data, body, now);
    assert.equal(a.status, 200);
    assert.equal(a.body.points, k === 0 ? -300 : 100);
    assert.equal(a.body.truth.fun, p.authored.explanation);
    assert.equal(a.body.truth.a_source, p.authored.source);
    assert.equal(a.body.truth[p.truth === 0 ? 'a_value' : 'b_value'], 'Correct');
    assert.deepEqual(await answer(db, data, { ...body, choice: 1 - body.choice, conf: 50 }, now), a);
    answers[q.id] = a.body;
    const card = String(detailCard({ ...r, answers }, k, (s) => s));
    assert.ok(card.includes(p.authored.source));
    assert.match(card, /class="fun"/);
    assert.doesNotMatch(card, /NaN/);
    const chat = playResult({ ...r, total: a.body.total }, k, body.choice, body.conf, a.body);
    assert.ok(chat.content.includes(p.authored.source));
    assert.ok(chat.content.includes(p.authored.explanation.replace(/[\\*_`~|>]/g, '\\$&')));
    assert.ok(chat.content.length < 2000);
  }
  const done = await complete(db, data, { round_id: r.round_id, anon_id: who, surface: 'web' }, now, 'https://whosbluffing.example');
  assert.equal(done.status, 200);
  assert.equal(done.body.score, 600);
  assert.match(done.body.roast, /100%/);
  assert.ok(done.body.challenge_url.includes(r.round_id));
  assert.deepEqual((await getRound(db, data, { round_id: r.round_id }, now)).body.items, r.items);
  assert.equal((await claimSide(db, data, 'ai', { round_id: r.round_id, anon_id: who, lab: 'other' }, now)).status, 200);
  const first = r.items[0];
  answers[first.id].truth.fun = '<img src=x onerror=alert(1)>';
  assert.ok(String(detailCard({ ...r, answers }, 0, (s) => s)).includes('&lt;img'));
  db.sqlite.close();
});

test('three flags retire only that authored question; fresh quick rounds refill, ranked stays identical', async () => {
  const db = openD1();
  const ranked = await getRound(db, data, { mode: 'ranked' }, now);
  const legacy = loadRounds(pool, pairs, days);
  assert.deepEqual(ranked, await getRound(db, legacy, { mode: 'ranked' }, now));
  const r = (await getRound(db, data, { mode: 'quick', pack: 'ai', difficulty: 'easy' }, now, seeded(4))).body;
  const q = r.items[0];
  for (let k = 0; k < 3; k++) {
    const b = { round_id: r.round_id, item_id: q.id, anon_id: `flagger-${k}-12345678901`, choice: 0, conf: 80, rt_ms: 1000, surface: 'web' };
    assert.equal((await answer(db, data, b, now)).status, 200);
    assert.equal((await flagPair(db, data, b, now)).status, 200);
  }
  assert.equal((await getRound(db, data, { round_id: r.round_id }, now)).body.items.length, 9);
  const fresh = await getRound(db, data, { mode: 'quick', pack: 'ai', difficulty: 'easy' }, now, seeded(4));
  assert.equal(fresh.status, 200);
  assert.equal(fresh.body.items.length, 10);
  assert.ok(!fresh.body.items.some((it) => it.id === q.id));
  assert.deepEqual(await getRound(db, data, { mode: 'ranked' }, now), ranked);
  db.sqlite.close();
});
