import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { WATCH, DARES, dare, replyIntent } from '../src/watch.js';

// X counts any URL as 23 characters.
const xLength = (s) => s.replace(/https?:\/\/\S+/g, 'x'.repeat(23)).length;
const dares = JSON.parse(readFileSync(new URL('../../dares/dares.json', import.meta.url), 'utf8'));
const members = WATCH.filter((u) => u.pack === 'politics');

test('handles are unique and every entry has an address and a deep link', () => {
  assert.equal(new Set(WATCH.map((u) => u.handle.toLowerCase())).size, WATCH.length);
  for (const u of WATCH) {
    assert.match(u.address, /^(Mr\.|Ms\.|Dr\.|Professor|Sir|Senator|Representative) /, u.handle);
    assert.match(u.link, /^https:\/\/whosbluffing\.com\/(dare\/[a-z][a-z0-9-]+|\?pack=(ai|history|companies|products|countries)&difficulty=(normal|brutal))$/, u.handle);
  }
});

test('every dare fits in a post for every person', () => {
  for (const u of WATCH) for (let i = 0; i < 5; i++) assert.ok(xLength(dare(u, String(i))) <= 280, `${u.handle} line ${i}`);
});

test('dare links are the people of dares/dares.json, each linked to their own page', () => {
  const bySlug = new Map(dares.map((d) => [d.slug, d]));
  for (const [handle, slug] of Object.entries(DARES)) assert.equal(bySlug.get(slug)?.handle, handle, slug);
});

test('members of Congress: the 24 of dares/dares.json, 12 per side, addressed as there, with their dare page and the politics lines', () => {
  const byHandle = new Map(dares.filter((d) => d.party).map((d) => [d.handle, d]));
  assert.equal(members.length, 24);
  assert.deepEqual(members.map((u) => u.handle).sort(), [...byHandle.keys()].sort());
  const side = (u) => byHandle.get(u.handle).caucus ?? byHandle.get(u.handle).party;
  assert.deepEqual(['democrat', 'republican'].map((s) => members.filter((u) => side(u) === s).length), [12, 12]);
  for (const u of members) {
    const d = byHandle.get(u.handle);
    assert.equal(u.address, d.address);
    assert.equal(u.link, `https://whosbluffing.com/dare/${d.slug}`);
  }
  const senator = members.find((u) => u.handle === 'tedcruz');
  const lines = [0, 1, 2, 3, 4].map((i) => dare(senator, String(i)));
  assert.equal(new Set(lines).size, 5);
  for (const line of lines) {
    assert.ok(line.startsWith('Senator Cruz, ') && line.endsWith(' https://whosbluffing.com/dare/cruz'), line);
    assert.doesNotMatch(line, /!|democrat|republican|liberal|conservative|party|vote|left-wing|right-wing|MAGA|woke/i, line);
  }
  assert.match(lines.join(' '), /ten questions about Congress's own record, written for you/);
  assert.match(lines.join(' '), /your supporters can take/);
  const general = dare(WATCH.find((u) => u.handle === 'sama'), '0');
  assert.ok(!lines.includes(general.replace('Mr. Altman', 'Senator Cruz').replace('dare/altman', 'dare/cruz')), 'politicians get their own lines');
  assert.equal(dare(members.find((u) => u.handle === 'AOC'), '7'), dare(members.find((u) => u.handle === 'AOC'), '2'), 'rotated by post id');
});

test('the reply intent carries the parent id and the encoded text', () => {
  const url = new URL(replyIntent('123', 'Mr. Altman, a test: https://whosbluffing.com/?pack=ai&difficulty=brutal'));
  assert.equal(url.searchParams.get('in_reply_to'), '123');
  assert.equal(url.searchParams.get('text'), 'Mr. Altman, a test: https://whosbluffing.com/?pack=ai&difficulty=brutal');
});
