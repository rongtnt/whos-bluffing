// The parity-plus pass: quick-round packs on the real data, the generated parts of the pages (question count, pack
// chips, command cards), CORS on the public reads, the bots' host gate, the picker's rules, the share text, the licence
// wording and the status page's verdicts.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { openD1 } from './d1.js';
import { loadRounds, getRound, packAvailability, servablePairs, PACKS, DIFFICULTIES, MIN_PACK_PAIRS } from '../functions/_rounds.js';
import { questionCount, packChips, commandCards, inject, pngSize } from '../scripts/sync-pages.js';
import { onRequest as gate } from '../functions/_middleware.js';
import { onRequestGet as kpiGet } from '../functions/api/kpi/index.js';
import { nearestDifficulty, settle, choose, shareWith, quickLabel } from '../public/picker.js';
import { apiVerdict, kpiVerdict } from '../public/status.js';
import { COMMANDS } from '../../discord/src/commands.js';
import { USAGE } from '../../slack/src/game.js';

const WEB = new URL('../', import.meta.url);
const read = (path) => readFileSync(new URL(path, WEB), 'utf8');
const json = (path) => JSON.parse(read(path));
const DATA = loadRounds(json('functions/_pool.json'), json('functions/_pairs.json'), json('functions/_rounds.json'));
const NOW = new Date(`${Object.keys(DATA.rounds).sort()[3]}T12:00:00Z`); // a day with a ranked round
const seeded = (seed) => { let s = seed; return () => ((s = (s * 1103515245 + 12345) % 2147483648) / 2147483648); };

test('packs: every offered pack and difficulty fills full rounds from its own categories under the difficulty rules', async () => {
  const db = openD1();
  const offer = packAvailability(DATA);
  assert.deepEqual(Object.keys(offer), Object.keys(DIFFICULTIES));
  for (const [difficulty, packs] of Object.entries(offer)) {
    assert.equal(packs[0], 'all');
    for (const pack of packs) {
      const cats = PACKS[pack].categories;
      for (let seed = 1; seed <= 4; seed += 1) {
        const r = await getRound(db, DATA, { mode: 'quick', difficulty, pack }, NOW, seeded(seed));
        assert.equal(r.status, 200, `${pack}/${difficulty}: ${JSON.stringify(r.body)}`);
        assert.equal(r.body.pack, pack);
        assert.equal(r.body.difficulty, difficulty);
        const pairs = r.body.items.map((i) => DATA.pairs.get(i.id));
        assert.equal(pairs.length, 10, `${pack}/${difficulty} seed ${seed}`);
        if (cats) assert.ok(pairs.every((p) => cats.includes(DATA.items.get(p.a_id).category)), `${pack}: a pair from outside the pack`);
        assert.ok(pairs.every((p) => DIFFICULTIES[difficulty].ok(p)), `${pack}/${difficulty}: a pair the difficulty does not allow`);
        if (difficulty === 'normal') assert.ok(pairs.filter((p) => p.band < 2).length <= 1, `${pack}: more than one lesser-known pair`);
      }
    }
  }
});

test('packs: unknown pack 400; a pack the difficulty cannot fill 400 (never a short round); ranked rounds ignore it', async () => {
  const db = openD1();
  const offer = packAvailability(DATA);
  assert.deepEqual(await getRound(db, DATA, { mode: 'quick', pack: 'cheese' }, NOW), { status: 400, body: { error: 'unknown pack' } });
  const missing = Object.keys(PACKS).filter((k) => !offer.normal.includes(k));
  assert.ok(missing.length > 0);
  for (const pack of missing) {
    assert.deepEqual(await getRound(db, DATA, { mode: 'quick', difficulty: 'normal', pack }, NOW),
      { status: 400, body: { error: 'not enough questions in this pack at this difficulty' } });
  }
  const ranked = await getRound(db, DATA, { mode: 'ranked', pack: 'cheese' }, NOW);
  assert.equal(ranked.status, 200);
  assert.equal(ranked.body.items.length, 10);
  assert.equal((await getRound(db, DATA, { mode: 'quick' }, NOW, seeded(3))).body.pack, 'all');
});

test('packs: the bar is 200 eligible pairs, and small fixtures can lower it', () => {
  assert.equal(MIN_PACK_PAIRS, 200);
  const lowBar = loadRounds(json('functions/_pool.json'), json('functions/_pairs.json'), json('functions/_rounds.json'), { minPackPairs: 1 });
  assert.ok(packAvailability(lowBar).brutal.length >= packAvailability(DATA).brutal.length);
});

test('home page: the question count and the pack chips are what the data says (scripts/sync-pages.js)', () => {
  const home = read('public/index.html');
  const count = servablePairs(DATA).size;
  assert.ok(count > 10000 && count < json('functions/_pairs.json').pairs.length, `${count} servable pairs`);
  assert.ok(home.includes(`<!-- questions -->${questionCount(count)}<!-- /questions --> questions, every one with a source`));
  assert.equal(questionCount(17142), '17,000+');
  assert.ok(home.includes(`<!-- packs -->${packChips(packAvailability(DATA))}<!-- /packs -->`));
  const chips = [...home.matchAll(/data-pack="([a-z]+)" data-difficulties="([a-z ]+)"/g)].map((m) => [m[1], m[2]]);
  assert.equal(chips[0][0], 'all');
  for (const [pack, levels] of chips) for (const d of levels.split(' ')) assert.ok(packAvailability(DATA)[d].includes(pack), `${pack} at ${d}`);
  assert.throws(() => inject('<p></p>', 'packs', 'x'), /marker <!-- packs --> not found/);
  assert.match(home, /<span>Play now<\/span>/);
  assert.match(home, /href="\/discord"><svg[^>]*>.*?<span>Add to Discord<\/span>/);
  assert.match(home, /href="\/slack"><svg[^>]*>.*?<span>Add to Slack<\/span>/);
});

test('commands.json: the Discord and Slack cards match the bots\' own command definitions', () => {
  const commands = json('public/commands.json');
  const subs = COMMANDS[0].options;
  assert.deepEqual(commands.discord.commands.map((c) => c.name), subs.map((s) => `/bluff ${s.name}`));
  for (const s of subs) {
    const card = commands.discord.commands.find((c) => c.name === `/bluff ${s.name}`);
    assert.deepEqual(card.options.map((o) => o.name), (s.options ?? []).map((o) => o.name), s.name);
  }
  const usage = [...USAGE.matchAll(/`([^`]+)`/g)].map((m) => m[1]);
  assert.deepEqual(commands.slack.commands.map((c) => c.name), usage);
  for (const p of ['discord', 'slack', 'web']) {
    assert.ok(commands[p].commands.every((c) => c.does && c.who && Array.isArray(c.options)), p);
    assert.ok(commands[p].trouble.length >= 4, `${p}: "not working?" answers`);
  }
  assert.ok(commands.discord.commands.filter((c) => c.who === 'Manage Server').map((c) => c.name).join() === '/bluff setup,/bluff reveal');
});

test('command cards are written into /commands, /discord and /slack', () => {
  const commands = json('public/commands.json');
  const pages = { 'public/commands.html': ['discord', 'slack', 'web'], 'public/discord.html': ['discord'], 'public/slack.html': ['slack'] };
  for (const [file, platforms] of Object.entries(pages)) {
    const page = read(file);
    for (const p of platforms) assert.ok(page.includes(`<!-- commands:${p} -->${commandCards(commands[p])}<!-- /commands -->`), `${file}: ${p}`);
  }
  const page = read('public/commands.html');
  assert.equal([...page.matchAll(/role="tab"/g)].length, 3);
  assert.match(page, /data-filter="cmd-discord cmd-slack cmd-web"/);
});

test('CORS: GET /api/kpi is a public read', async () => {
  const res = await kpiGet({ env: { DB: openD1() } });
  assert.equal(res.status, 200);
  assert.equal(res.headers.get('access-control-allow-origin'), '*');
  assert.match(read('functions/api/round/stats.js'), /CACHE_HEADERS = \{ 'cache-control': 'public, max-age=60', \.\.\.CORS \}/);
});

test('host gate: bots.* serves /api/* only, and only with the bot key; other hosts pass untouched', async () => {
  const next = () => new Response('next');
  const call = async (url, key, env = { BOT_KEY: 'k3y' }) => {
    const res = await gate({ request: new Request(url, { headers: key ? { 'x-bluff-bot': key } : {} }), env, next });
    return [res.status, res.status === 200 ? await res.text() : (await res.json()).error];
  };
  assert.deepEqual(await call('https://whosbluffing.com/api/kpi'), [200, 'next']);
  assert.deepEqual(await call('https://whosbluffing.com/'), [200, 'next']);
  assert.deepEqual(await call('https://www.whosbluffing.com/api/round/stats', 'wrong'), [200, 'next']);
  assert.deepEqual(await call('https://bots.whosbluffing.com/api/kpi', 'k3y'), [200, 'next']);
  assert.deepEqual(await call('https://bots.whosbluffing.com/api/round/reveal?date=2026-10-20', 'k3y'), [200, 'next']);
  assert.deepEqual(await call('https://bots.whosbluffing.com/api/kpi'), [403, 'bot host requires key']);
  assert.deepEqual(await call('https://bots.whosbluffing.com/api/kpi', 'wrong'), [403, 'bot host requires key']);
  assert.deepEqual(await call('https://bots.whosbluffing.com/api/kpi', 'k3y', {}), [403, 'bot host requires key']); // no key set: nobody
  assert.deepEqual(await call('https://bots.whosbluffing.com/', 'k3y'), [404, 'not found']);
  assert.deepEqual(await call('https://bots.whosbluffing.com/slack', 'k3y'), [404, 'not found']);
  assert.deepEqual(await call('https://bots.whosbluffing.com/apix', 'k3y'), [404, 'not found']);
});

test('picker: a pack moves the difficulty to the nearest one it plays at; a difficulty moves the pack to All', () => {
  const offer = { all: ['easy', 'normal', 'brutal'], elements: ['brutal'], products: ['normal'], companies: ['easy', 'normal'] };
  assert.equal(nearestDifficulty('normal', ['brutal']), 'brutal');
  assert.equal(nearestDifficulty('normal', ['easy', 'brutal']), 'easy'); // a tie goes to the easier one
  assert.equal(nearestDifficulty('easy', ['normal', 'brutal']), 'normal');
  assert.deepEqual(settle({ pack: 'elements', difficulty: 'easy' }, offer), { pack: 'elements', difficulty: 'brutal' });
  assert.deepEqual(settle({ pack: 'nope', difficulty: 'hard' }, offer), { pack: 'all', difficulty: 'normal' });
  assert.deepEqual(settle(null, offer), { pack: 'all', difficulty: 'normal' });
  assert.deepEqual(choose({ pack: 'all', difficulty: 'normal' }, { pack: 'elements' }, offer),
    { pack: 'elements', difficulty: 'brutal', note: 'Elements needs Brutal, so the difficulty is Brutal now.' });
  assert.deepEqual(choose({ pack: 'companies', difficulty: 'easy' }, { difficulty: 'normal' }, offer), { pack: 'companies', difficulty: 'normal', note: '' });
  assert.deepEqual(choose({ pack: 'products', difficulty: 'normal' }, { difficulty: 'brutal' }, offer),
    { pack: 'all', difficulty: 'brutal', note: 'Products has too few Brutal questions, so the pack is All now.' });
  assert.equal(quickLabel('geography', 'brutal'), 'Geography · Brutal');
  assert.equal(quickLabel(undefined, undefined), 'All · Normal');
});

test('share text: the pack after the name unless it is All; the best line under the score, before the link', () => {
  const url = 'https://whosbluffing.com/c/ABCDEFGHJKLM/abcdefghij';
  const text = `Who's Bluffing? · Bluffer · 420 pts · 70% right at 80% sure · ${url}`;
  assert.equal(shareWith(text, { pack: 'all', url }), text);
  assert.equal(shareWith(text, { pack: 'history', url }), `Who's Bluffing? · History pack · Bluffer · 420 pts · 70% right at 80% sure · ${url}`);
  assert.equal(shareWith(text, { pack: 'history', line: 'Called it.', url }),
    `Who's Bluffing? · History pack · Bluffer · 420 pts · 70% right at 80% sure\n“Called it.”\n${url}`);
  assert.equal(shareWith('odd text', { line: 'Hi', url }), 'odd text\n“Hi”');
  assert.equal(shareWith(text, { pack: 'not-a-pack', url }), text);
});

test('licence wording: the new footer line everywhere; no "open source" in web copy except the terms\' negation', () => {
  const line = '<p class="foot-note">An independent, non-commercial project. Source published for transparency; all rights reserved (see <a href="https://github.com/rongtnt/whos-bluffing/blob/main/LICENSE">LICENSE on GitHub</a>).</p>';
  const pages = readdirSync(new URL('public/', WEB), { recursive: true }).filter((f) => f.endsWith('.html'));
  for (const f of pages) {
    const h = read(`public/${f}`);
    assert.ok(h.includes(line), `${f}: footer line`);
    const copy = f === 'terms.html' ? h.replace('It is not open source', '') : h;
    assert.doesNotMatch(copy, /open[- ]source/i, `${f}: "open source"`);
  }
  assert.match(read('public/terms.html'), /<h2 id="source-and-licence">Source and licence<\/h2>\n<p>The source code is published on/);
  const pkg = json('package.json');
  assert.equal(pkg.license, 'SEE LICENSE IN LICENSE');
  assert.equal(pkg.private, true);
  for (const f of ['public/site.js', 'public/home.js', 'public/rounds.js', 'README.md', 'NOTES.md']) assert.doesNotMatch(read(f), /open[- ]source/i, f);
});

test('status page: verdicts for the server check and the KPI run; press images are sized from their PNGs', () => {
  assert.deepEqual(apiVerdict({ ok: true, status: 200 }, 123.4), { state: 'up', text: 'Up · answered in 123 ms' });
  assert.equal(apiVerdict({ ok: true, status: 200 }, 2400).state, 'slow');
  assert.deepEqual(apiVerdict({ ok: false, status: 503 }, 10), { state: 'down', text: 'Not answering properly (HTTP 503)' });
  assert.equal(apiVerdict({ ok: false, status: 0 }, 10).state, 'down');
  assert.deepEqual(kpiVerdict({ as_of: null }), { state: 'wait', text: 'No daily run yet.' });
  assert.deepEqual(kpiVerdict({ as_of: '2026-10-19' }), { state: 'up', text: 'Latest run counted 2026-10-19 (UTC).' });
  assert.equal(kpiVerdict(null).state, 'down');
  assert.deepEqual(pngSize(readFileSync(new URL('public/og.png', WEB))), [1200, 630]);
  const press = read('public/press.html');
  for (const [, file, w, h] of press.matchAll(/src="\/press\/([a-z0-9-]+\.png)" width="(\d+)" height="(\d+)"/g)) {
    assert.deepEqual(pngSize(readFileSync(new URL(`public/press/${file}`, WEB))), [Number(w), Number(h)], file);
  }
});
