import { test } from 'node:test';
import assert from 'node:assert/strict';
import { questionText, revealAt, revealMessage } from '../src/game.js';

test('question text: composed from a bare prompt, kept when the prompt already names both options', () => {
  assert.equal(questionText({ prompt: 'Which is longer?', a: 'the Nile', b: 'the Danube' }), 'Which is longer: the Nile or the Danube?');
  assert.equal(questionText({ prompt: 'Which came first: the Eiffel Tower or the Brooklyn Bridge?', a: 'The Eiffel Tower', b: 'the Brooklyn Bridge' }),
    'Which came first: the Eiffel Tower or the Brooklyn Bridge?');
});

test('reveal time: post hour + 8 h, or the post hour it actually went up + 8 h when later', () => {
  const at = (iso) => new Date(revealAt('2026-10-31', 14, Date.parse(iso))).toISOString();
  assert.equal(at('2026-10-31T09:31:00Z'), '2026-10-31T22:00:00.000Z'); // manual post before the hour
  assert.equal(at('2026-10-31T14:00:02Z'), '2026-10-31T22:00:00.000Z');
  assert.equal(at('2026-10-31T20:15:00Z'), '2026-11-01T04:00:00.000Z'); // late post
});

test('reveal values: years without separators or unit, other values with both, sources only when given', () => {
  const q = { prompt: 'Which came first?', a: 'A <b>', b: 'B' };
  const years = revealMessage(q, { n: 1, pct_a: 100, pct_b: 0, correct: 0, a_value: 1903, b_value: 1927, unit: 'year' }, [], new Map(), null);
  assert.match(years.text, /\*Answer: A, A &lt;b&gt;\.\* A &lt;b&gt;: 1903 · B: 1927\n/);
  const km = revealMessage(q, { n: 1, pct_a: 0, pct_b: 100, correct: 1, a_value: 1234.5, b_value: 98765, unit: 'km', b_source: 'https://x.test/b' }, [], new Map(), null);
  assert.match(km.text, /A &lt;b&gt;: 1,234\.5 km · B: 98,765 km \(<https:\/\/x\.test\/b\|source>\)/);
});
