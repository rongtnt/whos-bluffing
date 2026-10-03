// Metrics must reproduce analysis/test_vectors.json (shared with the Python implementation), plus session scoring.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import * as m from '../functions/_metrics.js';

const vectors = JSON.parse(readFileSync(new URL('../../analysis/test_vectors.json', import.meta.url), 'utf8'));

function close(actual, expected, label) {
  if (expected === null) return assert.equal(actual, null, label);
  assert.equal(typeof actual, 'number', `${label}: expected a number, got ${actual}`);
  return assert.ok(Math.abs(actual - expected) < 1e-6, `${label}: ${actual} vs ${expected}`);
}

for (const c of vectors.cases) {
  test(`vector: ${c.name}`, () => {
    const { input: i, expected: e } = c;
    if ('conf' in i) {
      close(m.overconfidence(i.conf, i.correct), e.overconfidence, 'overconfidence');
      close(m.brier(i.conf, i.correct), e.brier, 'brier');
      close(m.auroc(i.conf, i.correct), e.auroc, 'auroc');
      if (e.bins) {
        const got = m.bins(i.conf, i.correct);
        assert.equal(got.length, e.bins.length);
        e.bins.forEach((b, k) => {
          assert.equal(got[k].conf, b.conf);
          assert.equal(got[k].n, b.n);
          close(got[k].acc, b.acc, `bin ${b.conf} acc`);
        });
      }
    } else {
      close(m.intervalHitRate(i.low, i.high, i.truth), e.interval_hit_rate, 'interval_hit_rate');
      close(m.intervalOverconfidence(i.low, i.high, i.truth), e.interval_overconfidence, 'interval_overconfidence');
    }
  });
}

test('every vector case was exercised', () => {
  assert.equal(vectors.cases.length, 7);
});

test('scoreSession scores 2afc and intervals, ignores attention items, recomputes correctness', () => {
  const items = new Map([
    ['t001', { id: 't001', type: '2afc', answer: 0 }],
    ['t002', { id: 't002', type: '2afc', answer: 1 }],
    ['r001', { id: 'r001', type: 'interval', answer: 100 }],
    ['r002', { id: 'r002', type: 'interval', answer: 5 }],
    ['c001', { id: 'c001', type: 'attention', answer: 0 }],
  ]);
  const answers = [
    { id: 't001', choice: 0, conf: 90, rt_ms: 2000.4 }, // correct
    { id: 't002', choice: 0, conf: 70, rt_ms: 3000 }, // wrong
    { id: 'r001', low: 100, high: 200, rt_ms: 4000 }, // hit (inclusive)
    { id: 'r002', low: 6, high: 9, rt_ms: 5000 }, // miss
    { id: 'c001', choice: 0, conf: 50, rt_ms: 1000 }, // attention passed; conf must not enter metrics
  ];
  const s = m.scoreSession(answers, items);
  assert.deepEqual(s.scores, { acc: 0.5, mean_conf: 0.8, overconf: 0.3, brier: 0.25, auroc: 1, int_hit: 0.5, int_overconf: 0.4 });
  assert.equal(s.passed_attention, true);
  assert.equal(s.n_2afc, 2);
  assert.equal(s.n_interval, 2);
  assert.equal(s.total_rt_ms, 15000);
  assert.deepEqual(s.interval_detail, [
    { id: 'r001', low: 100, high: 200, truth: 100, hit: 1 },
    { id: 'r002', low: 6, high: 9, truth: 5, hit: 0 },
  ]);
  assert.deepEqual(s.bins.find((b) => b.conf === 0.9), { conf: 0.9, n: 1, acc: 1 });
  assert.deepEqual(s.answers[0], { id: 't001', type: '2afc', choice: 0, conf: 90, rt_ms: 2000, correct: 1 });

  const failed = m.scoreSession([...answers.slice(0, 4), { id: 'c001', choice: 1, conf: 100, rt_ms: 900 }], items);
  assert.equal(failed.passed_attention, false);
});
