import { test } from 'node:test';
import assert from 'node:assert/strict';
import { localClock, lockedIn, questionText, revealAt, revealMessage, toUtcHour } from '../src/game.js';

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

test("reveal time follows the workspace's window: 8 h when never set, else its own", () => {
  const at = (delay, iso = '2026-10-31T14:00:02Z') => new Date(revealAt('2026-10-31', 14, Date.parse(iso), delay)).toISOString();
  assert.equal(at(null), '2026-10-31T22:00:00.000Z');
  assert.equal(at(undefined), '2026-10-31T22:00:00.000Z');
  assert.equal(at(2), '2026-10-31T16:00:00.000Z');
  assert.equal(at(20), '2026-11-01T10:00:00.000Z');
  assert.equal(at(23, '2026-10-31T23:40:00Z'), '2026-11-01T22:00:00.000Z'); // the latest possible reveal is still the next day
});

test("time zones: the member's hour to the UTC hour and back, either side of UTC, past midnight, off-hour zones", () => {
  for (const [hour, tzOffset, utc, back] of [
    [9, -4 * 3600, 13, '09:00'],
    [9, 10 * 3600, 23, '09:00'],
    [20, -10 * 3600, 6, '20:00'],
    [0, 3600, 23, '00:00'],
    [23, -3600, 0, '23:00'],
    [9, 5.5 * 3600, 3, '08:30'], // India
    [9, -3.5 * 3600, 12, '08:30'], // Newfoundland
    [9, 5.75 * 3600, 3, '08:45'], // Nepal
  ]) {
    assert.equal(toUtcHour(hour, tzOffset), utc, `${hour} at ${tzOffset}`);
    assert.equal(localClock(utc, tzOffset), back, `${utc} at ${tzOffset}`);
  }
});

test('reveal times are Slack date tokens: {date_short_pretty} {time}, with a UTC fallback', () => {
  assert.equal(lockedIn(1, 80, Date.parse('2026-11-01T04:00:00Z')),
    'Locked in: B at 80%. Reveal: <!date^1793505600^{date_short_pretty} {time}|Nov 1 04:00 UTC>.');
});

test('reveal values: years without separators or unit, other values with both, sources only when given', () => {
  const q = { prompt: 'Which came first?', a: 'A <b>', b: 'B' };
  const years = revealMessage(q, { n: 1, pct_a: 100, pct_b: 0, correct: 0, a_value: 1903, b_value: 1927, unit: 'year' }, [], new Map(), null);
  assert.match(years.text, /\*Answer: A, A &lt;b&gt;\.\* A &lt;b&gt;: 1903 · B: 1927\n/);
  const km = revealMessage(q, { n: 1, pct_a: 0, pct_b: 100, correct: 1, a_value: 1234.5, b_value: 98765, unit: 'km', b_source: 'https://x.test/b' }, [], new Map(), null);
  assert.match(km.text, /A &lt;b&gt;: 1,234\.5 km · B: 98,765 km \(<https:\/\/x\.test\/b\|source>\)/);
});
