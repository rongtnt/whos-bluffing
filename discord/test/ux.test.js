import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { loadRounds, pairView } from '../../web/functions/_rounds.js';
import { compactPairs, serverPool } from '../../web/scripts/sync-items.js';
import * as game from '../src/game.js';
import { COMPLETE } from './helpers.js';

const read = (path) => JSON.parse(readFileSync(new URL(path, import.meta.url), 'utf8'));
const data = loadRounds(serverPool(read('../../items/pool.json')), compactPairs(read('../../items/pairs.json')),
  read('../../daily/rounds.json'), { curated: read('../../items/quick_curated.json').items });
const state = (q) => ({ round_id: '0123456789abcdef0123456789abcdef', pack: 'geography', difficulty: 'brutal', items: Array(10).fill(q), total: -3000 });

function withinLimits(message, note) {
  assert.ok(message.content.length <= 2000, `${note}: ${message.content.length} characters`);
  assert.ok((message.components?.length ?? 0) <= 5, `${note}: too many rows`);
  for (const row of message.components ?? []) {
    assert.ok(row.components.length <= 5, `${note}: too many buttons`);
    for (const c of row.components) {
      if (c.label) assert.ok(c.label.length <= 80, `${note}: button label`);
      if (c.custom_id) assert.ok(c.custom_id.length <= 100, `${note}: button id`);
      if (c.options) {
        assert.ok(c.options.length <= 25, `${note}: select options`);
        assert.ok(c.options.every((o) => o.label.length <= 100 && o.value.length <= 100));
      }
    }
  }
}

test('real long choices are readable before selection; ordinary questions stay compact for solo and party', () => {
  const q = pairView(data, 'p39191');
  assert.ok(q.a.length + 4 > 80);
  for (const prefix of ['p', 't']) {
    const msg = game.playQuestion(state(q), 0, prefix);
    assert.ok(msg.content.includes(game.esc(q.a)));
    assert.ok(msg.content.includes(game.esc(q.b)));
    assert.match(msg.components[0].components[0].label, /…$/);
    const short = { id: 'short', prompt: 'Which is bigger?', a: 'Earth', b: 'Mars' };
    const ordinary = game.playQuestion(state(short), 0, prefix);
    assert.ok(!ordinary.content.includes('Earth') && !ordinary.content.includes('Mars'));
  }
});

test('confidence explains the first decision once per round and keeps later questions short', () => {
  const s = state({ id: 'q', prompt: 'Which is bigger?', a: 'Earth', b: 'Mars' });
  for (const prefix of ['p', 't']) {
    const first = game.playConfidence(s, 0, 0, prefix);
    assert.ok(first.content.includes('50% = guessing. 100% = certain. Being confidently wrong costs more. Tap a percentage to lock in.'));
    assert.equal(first.components.at(-1).components[0].label, 'Change answer');
    const later = game.playConfidence(s, 1, 1, prefix);
    assert.match(later.content, /Say how sure you are\.$/);
    assert.doesNotMatch(later.content, /Being confidently wrong/);
  }
});

test('current question bank and entry/results messages fit Discord content and component limits', () => {
  for (const p of data.pairs.values()) {
    const q = pairView(data, p.id), s = state(q);
    const a = data.items.get(p.a_id), b = data.items.get(p.b_id);
    const truth = { a_value: a.answer, b_value: b.answer, unit: a.en.unit, a_source: a.source, b_source: b.source,
      fun: p.authored?.explanation || a.fun || b.fun };
    const question = game.playQuestion(s, 0, 't');
    withinLimits({ ...question, content: `**Geography · Brutal party · ${game.esc('@'.repeat(32))}**\n${question.content}` }, `${p.id} question`);
    for (const choice of [0, 1]) withinLimits(game.playConfidence(s, 0, choice), `${p.id} confidence`);
    withinLimits(game.playResult(s, 0, p.truth, 100, { truth, correct: true, points: 100 }), `${p.id} answer`);
  }
  const party = { id: '0123456789abcdef0123456789abcdef', pack: 'geography', difficulty: 'brutal', expires_at: Date.now() + 3600000,
    lobby_url: 'https://discord.com/channels/1/2/3' };
  const board = { joined: 1000, finished: 1000, top: Array.from({ length: 10 }, () => ({ name: '@'.repeat(32), score: -3000 })) };
  for (const message of [game.WELCOME, game.channelHello(14, Date.now()), { content: game.help(null, Date.now()), components: game.playButtons() },
    game.partyLobby(party, board), game.partyResults(party, board), game.partyDone(party, { name: '@'.repeat(32), done: COMPLETE }),
    game.playEnd(COMPLETE, 'px:0123456789abcdef0123456789abcdef', 'https://discord.com/oauth2/authorize', state({})),
    game.feedback(party.id, 9)]) withinLimits(message, 'entry/result');
  for (const pack of Object.keys(data.packLists)) for (const difficulty of game.difficulties(pack)) {
    withinLimits(game.roundSetup({ ...party, mode: 'party', pack, difficulty, revision: 1 }), `${pack}/${difficulty} picker`);
  }
});
