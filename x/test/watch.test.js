import test from 'node:test';
import assert from 'node:assert/strict';
import { WATCH, dare, replyIntent } from '../src/watch.js';

// X counts any URL as 23 characters.
const xLength = (s) => s.replace(/https?:\/\/\S+/g, 'x'.repeat(23)).length;

test('handles are unique and every entry has an address and a deep link', () => {
  assert.equal(new Set(WATCH.map((u) => u.handle.toLowerCase())).size, WATCH.length);
  for (const u of WATCH) {
    assert.match(u.address, /^(Mr\.|Ms\.|Dr\.|Professor|Sir) /, u.handle);
    assert.match(u.link, /^https:\/\/whosbluffing\.com\/(dare\/[a-z]+|\?pack=(ai|history|companies|products|countries)&difficulty=(normal|brutal))$/, u.handle);
  }
});

test('every dare fits in a post for every person', () => {
  for (const u of WATCH) for (let i = 0; i < 5; i++) assert.ok(xLength(dare(u, String(i))) <= 280, `${u.handle} line ${i}`);
});

test('the reply intent carries the parent id and the encoded text', () => {
  const url = new URL(replyIntent('123', 'Mr. Altman, a test: https://whosbluffing.com/?pack=ai&difficulty=brutal'));
  assert.equal(url.searchParams.get('in_reply_to'), '123');
  assert.equal(url.searchParams.get('text'), 'Mr. Altman, a test: https://whosbluffing.com/?pack=ai&difficulty=brutal');
});
