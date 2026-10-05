import test from 'node:test';
import assert from 'node:assert/strict';
import { pickReplies } from '../src/replies.js';

test('a model launch gets the release-order question first, two drafts in all', () => {
  const d = pickReplies('Grok 5 training run finished. Release next month.');
  assert.equal(d.length, 2);
  assert.match(d[0], /ChatGPT or Stable Diffusion/);
  assert.notEqual(d[0], d[1]);
});

test('an unrelated post still gets two drafts', () => {
  assert.equal(pickReplies('Good morning').length, 2);
});

test('a somber post gets none', () => {
  assert.deepEqual(pickReplies('Terrible news about the crash this morning. Condolences to the families.'), []);
});
