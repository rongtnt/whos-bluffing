// The dare board (briefs/BRIEF_dares.md): the picker (scripts/build-dares.js) on a fixture pool, the fixed rounds dr-<slug>
// and their ranks on a real SQLite database (test/d1.js), the board's numbers, the pages, the end-screen builders, and
// the real dares/dares.json. HTTP wiring is covered by test/smoke.sh.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { openD1 } from './d1.js';
import { loadRounds, getRound, answer, complete, compare } from '../functions/_rounds.js';
import { dareView, boardView, darePage, boardPage, statusLine, dareShareText, fmtDate, OFFICIAL } from '../functions/_dares.js';
import { HEADERS } from '../functions/_challenge.js';
import { serverPool, compactPairs } from '../scripts/sync-items.js';
import { pickDare, pinnedErrors, buildDares, seedErrors, dareContext, pretty, balanced, sideOf, DATED, EXAMPLE_PAIR, KEYWORD_FLOOR, SIDES } from '../scripts/build-dares.js';
import { dareDone } from '../public/round-end.js';

// --- fixture: 40 companies (every fifth an "Acme"), pairs 1, 2, 3 and 5 apart, plus the cases the rules exclude -------
const w = (n) => `w${String(n).padStart(4, '0')}`;
const p = (n) => `p${String(n).padStart(5, '0')}`;
const item = (n, name, extra = {}) => ({ id: w(n), type: 'interval', category: 'company_founded', domain: 'history',
  en: { prompt: `When was ${name} founded?`, unit: 'year' }, answer: 1800 + n, accept: [1000, 3000],
  source: `https://www.wikidata.org/wiki/Q${5000 + n}#P571`, name, ref_quality: 'referenced', fact_checked: false, volatile: false, ...extra });
const items = Array.from({ length: 40 }, (_, k) => item(k + 1, (k + 1) % 5 === 1 ? `Acme ${k + 1}` : `Firm ${k + 1}`));
items.push(
  item(41, 'Acme Volatile', { volatile: true }),
  item(42, 'Acme Unchecked', { ref_quality: 'none' }),
  item(43, 'Acme Checked', { ref_quality: 'none', fact_checked: true }),
  item(44, 'Acme board fires its chief (Nov 2023)', { category: 'ai_drama', en: { prompt: 'When?', unit: 'month' }, answer: 202311, fact_checked: true }),
  item(45, 'Acme chief returns', { category: 'ai_drama', en: { prompt: 'When?', unit: 'month' }, answer: 202402, fact_checked: true }),
  item(46, 'Acme 6'), // a second record named like w0006: the same item to a player
  item(47, 'The Senate passes a budget (Mar 2020)', { category: 'pol_drama', en: { prompt: 'When?', unit: 'month' }, answer: 202003, fact_checked: true }),
);
const LEVEL = ['easy', 'medium', 'hard'];
const pairs = [];
const pair = (id, a, b, extra = {}) => pairs.push({ id, a_id: w(a), b_id: w(b), truth: items[a - 1].answer < items[b - 1].answer ? 0 : 1,
  difficulty_hint: LEVEL[(a + b) % 3], fame: 60000, ref_quality: 'referenced', ...extra });
for (let i = 1; i <= 40; i += 1) for (const step of [1, 2, 3, 5]) if (i + step <= 40) pair(p(pairs.length + 1), i, i + step, step === 5 ? { fame: 30000 } : {});
const SPECIAL = { volatileItem: p(901), unreferenced: p(902), checked: p(903), volatilePair: p(904), dated: p(905), undated: p(906), sameName: p(907), polDated: p(908) };
pair(SPECIAL.volatileItem, 41, 2, { difficulty_hint: 'medium' });
pair(SPECIAL.unreferenced, 42, 3, { difficulty_hint: 'medium' });
pair(SPECIAL.checked, 43, 4, { difficulty_hint: 'medium' });
pair(SPECIAL.volatilePair, 11, 19, { difficulty_hint: 'medium', volatile: true });
pair(SPECIAL.dated, 44, 7, { difficulty_hint: 'medium' });
pair(SPECIAL.undated, 45, 8, { difficulty_hint: 'medium' });
pair(SPECIAL.sameName, 46, 9, { difficulty_hint: 'hard' });
pair(SPECIAL.polDated, 47, 10, { difficulty_hint: 'medium' });
pair(EXAMPLE_PAIR, 1, 13, { difficulty_hint: 'medium' });
const TEMPLATES = [{ category: 'company_founded', unit: 'year', prompt: 'Which company was founded first?', more: 'was founded first', less: 'was founded later' }];
const POOL = { version: 1, items };
const DOC = { templates: TEMPLATES, pairs };
const RANKED_DAY = { ranked: [p(2), p(5), p(9), p(14), p(17), p(22), p(25), p(30), p(33), p(38)], question: p(41) };
const ROUNDS = { '2026-11-10': RANKED_DAY };
const dataFor = (dares = []) => loadRounds(serverPool(POOL), compactPairs(DOC), ROUNDS, { minPackPairs: 0, dares });
const CTX = dareContext({ pool: POOL, doc: DOC, rounds: ROUNDS, data: dataFor() });
const seed = (slug, extra = {}) => ({ slug, name: `${slug[0].toUpperCase()}${slug.slice(1)} Person`, address: `Mr. ${slug[0].toUpperCase()}${slug.slice(1)}`,
  org: 'Acme', pronoun: 'he', pack: 'companies', difficulty: 'brutal', keywords: ['Acme'], rival: null, issued: '2026-10-05', dare_url: null,
  status: 'open', their_score: null, ...extra });
const byId = new Map(pairs.map((x) => [x.id, x]));
const namesOf = (ids) => ids.flatMap((id) => [items.find((i) => i.id === byId.get(id).a_id).name, items.find((i) => i.id === byId.get(id).b_id).name]);
const keywordPairs = (ids, kw = 'acme') => ids.filter((id) => namesOf([id]).some((n) => n.toLowerCase().includes(kw))).length;

test('picker: ten pairs, no item twice (by name), at least five naming a keyword, the difficulty\'s mix, deterministic per slug', () => {
  const brutal = pickDare(seed('acme'), CTX);
  assert.equal(brutal.error, undefined);
  assert.equal(brutal.items.length, 10);
  assert.equal(new Set(brutal.items).size, 10);
  assert.equal(new Set(namesOf(brutal.items)).size, 20, 'twenty different names');
  assert.ok(keywordPairs(brutal.items) >= KEYWORD_FLOOR);
  assert.deepEqual(['easy', 'medium', 'hard'].map((lv) => brutal.items.filter((id) => byId.get(id).difficulty_hint === lv).length), [0, 4, 6]);
  assert.deepEqual(pickDare(seed('acme'), CTX), brutal, 'same slug, same ten');
  assert.notDeepEqual(pickDare(seed('acme-two'), CTX).items, brutal.items, 'seeded by the slug');
  const normal = pickDare(seed('acme', { difficulty: 'normal' }), CTX);
  assert.deepEqual(['easy', 'medium', 'hard'].map((lv) => normal.items.filter((id) => byId.get(id).difficulty_hint === lv).length), [3, 4, 3]);
  assert.ok(normal.items.filter((id) => byId.get(id).fame < 50000).length <= 1, 'Normal: at most one pair under 50,000 views');
  assert.deepEqual(pinnedErrors({ ...seed('acme'), items: brutal.items }, CTX), []);
});

test('picker: never the example pair, a volatile item or pair, an unreferenced item, a dated ai_drama item, a ranked pair, a repeated name', () => {
  // A valid pick with `id` moved in front (ten different ids either way).
  const front = (dare, picked, id) => pinnedErrors({ ...dare, items: [id, ...picked.filter((x) => x !== id)].slice(0, 10) }, CTX);
  const ok = pickDare(seed('acme'), CTX).items;
  for (const id of [EXAMPLE_PAIR, SPECIAL.volatileItem, SPECIAL.unreferenced, SPECIAL.volatilePair, RANKED_DAY.ranked[0], RANKED_DAY.question]) {
    assert.ok(front(seed('acme'), ok, id).some((e) => e.startsWith(`${id} is not allowed`)), id);
  }
  assert.ok(!front(seed('acme'), ok, SPECIAL.checked).some((e) => e.includes('not allowed')), 'fact-checked items are allowed');
  const all = seed('acme', { pack: 'all' });
  const okAll = pickDare(all, CTX).items;
  assert.ok(front(all, okAll, SPECIAL.dated).some((e) => e.startsWith(`${SPECIAL.dated} is not allowed`)), 'an ai_drama name with a date');
  assert.ok(!front(all, okAll, SPECIAL.undated).some((e) => e.includes('not allowed')), 'an ai_drama name without a date');
  assert.ok(front(all, okAll, SPECIAL.polDated).some((e) => e.startsWith(`${SPECIAL.polDated} is not allowed`)), 'a pol_drama name with a date');
  const withSix = pairs.find((q) => q.a_id === w(6) && q.b_id === w(7)).id; // Acme 6 vs Firm 7, medium
  const twice = pinnedErrors({ ...seed('acme'), items: [SPECIAL.sameName, withSix, ...ok.filter((id) => id !== withSix && id !== SPECIAL.sameName)].slice(0, 10) }, CTX);
  assert.ok(twice.includes(`${withSix} repeats an item or breaks the mix of levels`), 'two records named Acme 6 are one item');
  for (const [name, yes] of [['OpenAI fires Sam Altman (Nov 2023)', true], ['17 November: the board meets', true], ['Founded in 2015', true],
    ['Sam Altman returns as OpenAI CEO', false], ['The US AI executive order 14110 is rescinded', false], ['SB 1047 is vetoed', false], ['May the best model win', false]]) {
    assert.equal(DATED.test(name), yes, name);
  }
  for (const id of [...pickDare(seed('acme'), CTX).items, ...okAll]) assert.ok(id !== EXAMPLE_PAIR && !RANKED_DAY.ranked.includes(id));
});

test('picker: a dare it cannot fill says why; kept picks are checked, not redrawn', () => {
  assert.equal(pickDare(seed('firm', { keywords: ['Firm 3', 'Firm 4'] }), CTX).error, undefined, 'Firm 3, 30, 32-35, 37-39, 4 and 40');
  const none = pickDare(seed('ghost', { keywords: ['Globex'] }), CTX);
  assert.match(none.error, /^no usable item in the Companies pack \(brutal\) names a keyword \(Globex\); 5 keyword pairs need 5 such items/);
  const one = pickDare(seed('one', { keywords: ['Firm 37'] }), CTX);
  assert.match(one.error, /^only 1 usable item in the Companies pack \(brutal\) names a keyword \(Firm 37\)/);
  const kept = seed('acme', { items: pickDare(seed('acme'), CTX).items.slice().reverse() });
  const built = buildDares([kept], CTX);
  assert.deepEqual([built.errors, built.dares[0].items], [[], kept.items], 'kept as written');
  const broken = buildDares([{ ...kept, items: [EXAMPLE_PAIR, ...kept.items.slice(1)] }], CTX);
  assert.ok(broken.errors.some((e) => e.startsWith(`acme: ${EXAMPLE_PAIR} is not allowed`)), 'fails loudly');
});

test('build: seed rules stop the build; removed and unfilled dares stay off the board; the bundle has what the runtime reads', () => {
  const bad = [
    seed('one', { status: 'pending' }), seed('two', { their_score: { score: 600, url: 'https://x.com/a/status/1', date: '2026-10-06' } }),
    seed('three', { status: 'played' }), seed('four', { rival: 'nobody' }), seed('Five'), seed('one'), seed('six', { pronoun: 'it' }),
    seed('seven', { dare_url: 'http://x.com/a' }), seed('eight', { status: 'played', their_score: { score: 601, url: 'https://x.com/a/status/1', date: '2026-10-06' } }),
  ];
  assert.deepEqual(seedErrors(bad).map((e) => e.split(':')[0]), ['one', 'two', 'three', 'four', 'Five', 'one', 'six', 'seven', 'eight']);
  assert.equal(buildDares(bad, CTX).compact.length, 0);
  const played = seed('bolt', { status: 'played', pronoun: undefined, their_score: { score: 640, url: 'https://x.com/bolt/status/1', date: '2026-10-12' }, rival: 'acme' });
  const r = buildDares([seed('acme', { rival: 'bolt' }), played, seed('gone', { status: 'removed' }), seed('ghost', { keywords: ['Globex'] })], CTX);
  assert.deepEqual(r.errors, []);
  assert.deepEqual(r.unfilled.map((u) => u.slug), ['ghost']);
  assert.deepEqual(r.compact.map((d) => d.slug), ['acme', 'bolt']);
  assert.equal(r.dares.find((d) => d.slug === 'gone').items, undefined, 'a removed dare is not picked');
  assert.deepEqual(Object.keys(r.compact[1]), ['slug', 'name', 'address', 'org', 'pronoun', 'pack', 'difficulty', 'rival', 'issued', 'dare_url', 'status', 'their_score', 'items']);
  assert.equal(r.compact[1].pronoun, 'they', 'no pronoun: they');
  assert.match(pretty(r.dares), /\n {4}"keywords": \["Acme"\],\n/);
  assert.deepEqual(JSON.parse(pretty(r.dares)), JSON.parse(JSON.stringify(r.dares)));
});

// --- portraits (dares.json `avatar` + `credit`; the files in public/img/dares) -------------------------------------------
const CREDIT = { source_url: 'https://commons.wikimedia.org/wiki/File:Portrait.jpg', author: 'A. Photographer', license: 'CC BY-SA 4.0' };

test('seed: an avatar is the file /img/dares/<slug>.jpg with a credit under a free licence; a credit needs an avatar', () => {
  const real = (slug, extra = {}) => seed(slug, { avatar: `/img/dares/${slug}.jpg`, credit: CREDIT, ...extra });
  assert.deepEqual(seedErrors([real('altman'), seed('acme')]), []);
  for (const license of ['public domain', 'CC0', 'CC BY 2.0', 'CC BY-SA 2.5 ar']) assert.deepEqual(seedErrors([real('altman', { credit: { ...CREDIT, license } })]), [], license);
  const bad = [
    real('ghost'), real('musk', { avatar: '/img/dares/altman.jpg' }), real('brockman', { avatar: 'https://example.com/brockman.jpg' }),
    real('lecun', { credit: undefined }), real('hassabis', { credit: { ...CREDIT, source_url: 'http://commons.wikimedia.org/wiki/File:X.jpg' } }),
    real('suleyman', { credit: { ...CREDIT, author: ' ' } }), real('srinivas', { credit: { ...CREDIT, license: 'CC BY-NC 4.0' } }),
    real('nadella', { credit: { ...CREDIT, license: undefined } }), seed('pichai', { credit: CREDIT }),
  ];
  assert.deepEqual(seedErrors(bad).map((e) => e.split(': ')), [
    ['ghost', 'avatar must be /img/dares/<slug>.jpg, a file in web/public'], ['musk', 'avatar must be /img/dares/<slug>.jpg, a file in web/public'],
    ['brockman', 'avatar must be /img/dares/<slug>.jpg, a file in web/public'],
    ...['lecun', 'hassabis', 'suleyman', 'srinivas', 'nadella'].map((slug) => [slug, 'an avatar needs credit {source_url (https), author, license (public domain, CC0, CC BY or CC BY-SA)}']),
    ['pichai', 'credit only with an avatar'],
  ]);
  const r = buildDares([seed('acme', { avatar: '/img/dares/acme.jpg', credit: CREDIT })], CTX);
  assert.match(r.errors[0], /^acme: avatar must be/, 'the build stops on a missing file');
});

// --- the fixed rounds dr-<slug> on D1 ----------------------------------------------------------------------------------
const NOW = new Date('2026-11-10T12:00:00Z');
const ORIGIN = 'https://whosbluffing.example';
const anon = (k) => `anon-${k}`.padEnd(22, 'x');
const BOARD = buildDares([
  seed('acme', { name: 'Ada Acme', address: 'Ms. Acme', pronoun: 'she', rival: 'bolt', dare_url: 'https://x.com/whosbluffing/status/9' }),
  seed('bolt', { name: 'Bo Bolt', address: 'Mr. Bolt', org: 'Bolt & Co', keywords: ['Acme'], status: 'played', rival: 'acme',
    their_score: { score: 640, url: 'https://x.com/bolt/status/1', date: '2026-10-12' } }),
  seed('cole', { name: 'Cy Cole', address: 'Professor Cole', pronoun: undefined, status: 'declined' }),
  seed('gone', { status: 'removed', items: [] }),
], CTX).dares.map((d) => ({ ...d, pronoun: d.pronoun ?? 'they' }));
const DATA = dataFor(BOARD);
const dareOf = (slug) => BOARD.find((d) => d.slug === slug);

async function playDare(db, who, slug, right, conf = () => 80) {
  for (const [k, id] of dareOf(slug).items.entries()) {
    const truth = DATA.pairs.get(id).truth;
    const r = await answer(db, DATA, { round_id: `dr-${slug}`, item_id: id, choice: right[k] ? truth : 1 - truth, conf: conf(k), anon_id: anon(who), surface: 'web' }, NOW);
    assert.equal(r.status, 200, JSON.stringify(r.body));
  }
  return complete(db, DATA, { round_id: `dr-${slug}`, anon_id: anon(who), surface: 'web' }, NOW, ORIGIN);
}
const all = (v) => Array(10).fill(v);

test('dare round: GET by round_id serves the fixed ten with pack, difficulty and person; removed or unknown 404; malformed 400', async () => {
  const db = openD1();
  const r = await getRound(db, DATA, { round_id: 'dr-acme' }, NOW);
  assert.equal(r.status, 200);
  assert.deepEqual({ ...r.body, items: r.body.items.map((i) => i.id) }, { round_id: 'dr-acme', mode: 'dare', date: '2026-10-05', pack: 'companies',
    difficulty: 'brutal', dare: { slug: 'acme', name: 'Ada Acme', address: 'Ms. Acme' }, items: dareOf('acme').items });
  assert.ok(!/wikidata|truth|value|answer/.test(JSON.stringify(r.body)));
  assert.deepEqual((await getRound(db, DATA, { round_id: 'dr-acme' }, NOW)).body, r.body, 'nothing stored, the same for everyone');
  assert.equal((await db.prepare('SELECT COUNT(*) AS n FROM rounds').first()).n, 0);
  for (const id of ['dr-gone', 'dr-nobody']) assert.deepEqual(await getRound(db, DATA, { round_id: id }, NOW), { status: 404, body: { error: 'unknown round' } });
  for (const id of ['dr-', 'dr-A', 'dr-x', 'dr-acme!']) assert.equal((await getRound(db, DATA, { round_id: id }, NOW)).status, 400, id);
});

test('dare round: complete adds rank (1 + plays scoring higher) and players, the dare page as the link, the brief\'s share text', async () => {
  const db = openD1();
  const a = await playDare(db, 'a', 'acme', [1, 1, 1, 1, 1, 1, 1, 0, 0, 0]); // 7 x 84 - 3 x 156 = 120
  assert.equal(a.status, 200);
  assert.deepEqual([a.body.score, a.body.rank, a.body.players, a.body.challenge_url], [120, 1, 1, `${ORIGIN}/dare/acme`]);
  assert.deepEqual(a.body.dare, { slug: 'acme', name: 'Ada Acme', address: 'Ms. Acme' });
  assert.equal(a.body.share_text, "I scored 120 on the ten questions written for Ada Acme. She hasn't taken it yet. whosbluffing.example/dare/acme");
  assert.ok(!('rank_today' in a.body));
  const b = await playDare(db, 'b', 'acme', all(1)); // 840
  assert.deepEqual([b.body.rank, b.body.players], [1, 2]);
  const c = await playDare(db, 'c', 'acme', all(0), () => 50); // 0
  assert.deepEqual([c.body.rank, c.body.players], [3, 3]);
  const again = await complete(db, DATA, { round_id: 'dr-acme', anon_id: anon('a'), surface: 'web' }, NOW, ORIGIN);
  assert.deepEqual([again.body.score, again.body.rank, again.body.players], [120, 2, 3], 'a repeat returns the same play, ranked now');
  assert.equal((await db.prepare("SELECT COUNT(*) AS n, MIN(mode) AS mode FROM round_plays WHERE round_id = 'dr-acme'").first()).mode, 'dare');
  const played = await playDare(db, 'a', 'bolt', all(1), () => 100);
  assert.equal(played.body.share_text, 'I scored 1000 on the ten questions written for Bo Bolt. Bo Bolt scored 640. whosbluffing.example/dare/bolt');
  const declined = await playDare(db, 'a', 'cole', all(1));
  assert.equal(declined.body.share_text, "I scored 840 on the ten questions written for Cy Cole. They haven't taken it yet. whosbluffing.example/dare/cole");
  assert.equal((await compare(db, DATA, 'dr-acme', anon('a'), 'notatoken0', NOW)).status, 404);
  const outside = pairs.find((q) => !dareOf('acme').items.includes(q.id)).id;
  assert.deepEqual(await answer(db, DATA, { round_id: 'dr-acme', item_id: outside, choice: 0, conf: 80, anon_id: anon('d'), surface: 'web' }, NOW),
    { status: 404, body: { error: 'item is not in this round' } });
  assert.equal((await answer(db, DATA, { round_id: 'dr-gone', item_id: outside, choice: 0, conf: 80, anon_id: anon('d'), surface: 'web' }, NOW)).status, 404);
});

test('board numbers: GET /api/dare/:slug and /api/dares, most played first, removed left out; 404 removed, 400 malformed', async () => {
  const db = openD1();
  await playDare(db, 'a', 'acme', [1, 1, 1, 1, 1, 1, 1, 0, 0, 0]);
  await playDare(db, 'b', 'acme', all(1));
  await playDare(db, 'c', 'bolt', all(0), () => 50);
  const v = (await dareView(db, DATA, 'acme', NOW)).body;
  assert.deepEqual(v, { slug: 'acme', name: 'Ada Acme', address: 'Ms. Acme', org: 'Acme', status: 'open', issued: '2026-10-05',
    dare_url: 'https://x.com/whosbluffing/status/9', players: 2, best: 840, mean_score: 480, mean_overconfidence: -5, their_score: null,
    rival: { slug: 'bolt', address: 'Mr. Bolt', players: 1, mean_score: 0, status: 'played' }, as_of: NOW.toISOString() });
  const cole = (await dareView(db, DATA, 'cole', NOW)).body;
  assert.deepEqual([cole.players, cole.best, cole.mean_score, cole.mean_overconfidence, cole.rival], [0, null, null, null, null]);
  assert.deepEqual(await dareView(db, DATA, 'gone', NOW), { status: 404, body: { error: 'unknown dare' } });
  assert.deepEqual(await dareView(db, DATA, 'nobody', NOW), { status: 404, body: { error: 'unknown dare' } });
  assert.deepEqual(await dareView(db, DATA, 'Bad Slug', NOW), { status: 400, body: { error: 'bad slug' } });
  const board = (await boardView(db, DATA, NOW)).body;
  assert.deepEqual(board.dares.map((d) => [d.slug, d.players, d.mean_score]), [['acme', 2, 480], ['bolt', 1, 0], ['cole', 0, null]]);
  assert.deepEqual(Object.keys(board.dares[0]), ['slug', 'name', 'address', 'org', 'status', 'players', 'mean_score', 'their_score', 'issued']);
  await playDare(db, 'd', 'bolt', all(1));
  await playDare(db, 'e', 'bolt', all(1));
  assert.deepEqual((await boardView(db, DATA, NOW)).body.dares.map((d) => d.slug), ['bolt', 'acme', 'cole']);
});

test('pages: /dare/:slug and /dares on the site template; status lines; Open Graph per page; CSP-safe; escaped', async () => {
  const template = readFileSync(new URL('../scripts/page.html', import.meta.url), 'utf8');
  const db = openD1();
  await playDare(db, 'a', 'acme', [1, 1, 1, 1, 1, 1, 1, 0, 0, 0]);
  const page = darePage(template, (await dareView(db, DATA, 'acme', NOW)).body, DATA.dares);
  const want = (s) => assert.ok(page.includes(s), s);
  want('<title>Ten questions about Acme, written for Ms. Acme | Who&#39;s Bluffing?</title>');
  want('<meta property="og:title" content="Ten questions about Acme, written for Ms. Acme | Who&#39;s Bluffing?">');
  want('<meta property="og:description" content="Same ten for everyone. Ms. Acme: no score yet.">');
  want('<meta property="og:url" content="https://whosbluffing.com/dare/acme">');
  want('<h1 id="hero-title">Ten questions about Acme, written for Ms. Acme</h1>');
  want('<p class="hero-sub">Same ten for everyone. Being sure only pays when you\'re right.</p>');
  want('<div class="tiles dare-tiles"><div class="tile"><b>120</b><span>best score</span></div><div class="tile"><b>120</b><span>average score</span></div></div>');
  assert.ok(!page.includes('taken it</span>') && !/\d taken/.test(page), 'no count of people on the dare page');
  want('<div class="card dare-status"><span class="dare-face dare-mono" role="img" aria-label="Ada Acme">AA</span><div><p>Ms. Acme: no score yet</p><p class="fine">Read <a href="https://x.com/whosbluffing/status/9" rel="noopener noreferrer">the dare</a> on X.</p></div></div>');
  want('<button class="primary" id="play" type="button" data-play>');
  want('<a href="/dare/bolt">Mr. Bolt’s round</a>: Mr. Bolt: 640, <a href="https://x.com/bolt/status/1" rel="noopener noreferrer">posted 12 October 2026</a>');
  want('<p><a href="/dares">The dare board</a></p>');
  want('Public figures only. If your name is here and you would rather it weren’t, write to <a href="mailto:hello@whosbluffing.com">hello@whosbluffing.com</a> and it comes off within a day.');
  want('<script src="/site.js"></script>\n<script type="module" src="/app.js"></script>');
  assert.ok(!page.includes('noindex') && !page.includes('{{'));
  const HEADER = /<header class="nav">[\s\S]*?<\/header>/;
  const FOOTER = /<footer class="site-foot">[\s\S]*?<\/footer>/;
  const boardHtml = boardPage(template, (await boardView(db, DATA, NOW)).body, DATA.dares);
  for (const h of [page, boardHtml]) {
    assert.equal(h.match(HEADER)[0], template.match(HEADER)[0]);
    assert.equal(h.match(FOOTER)[0], template.match(FOOTER)[0]);
    assert.doesNotMatch(h, /<script(?![^>]*\bsrc=)[^>]*>/, 'inline script');
    assert.doesNotMatch(h, /\sstyle=|<style|\son[a-z]+=/i, 'inline style or handler');
  }
  assert.ok(boardHtml.includes('<h1>The dare board</h1>'));
  assert.ok(boardHtml.includes('<p class="lead">Each person got ten questions about their own field. Everyone can take the same ten. The board shows who has answered.</p>'));
  assert.ok(boardHtml.includes('<tr><th scope="row"><span class="dare-face dare-face-sm dare-mono" role="img" aria-label="Ada Acme">AA</span><a href="/dare/acme">Ada Acme</a></th><td>Acme</td><td>120</td><td>no score yet</td><td><a href="https://x.com/whosbluffing/status/9" rel="noopener noreferrer">the dare</a></td></tr>'));
  assert.ok(boardHtml.includes('<td>Bolt &amp; Co</td><td>–</td><td>posted 640</td><td>–</td>'));
  assert.ok(!boardHtml.includes('People who have taken it') && boardHtml.includes('<th scope="col">Average score</th><th scope="col">Status</th>'));
  assert.ok(boardHtml.includes('<td>declined</td>') && !boardHtml.includes('/dare/gone'));
  assert.ok(boardHtml.indexOf('/dare/acme') < boardHtml.indexOf('/dare/bolt'), 'most played first');
  const cole = darePage(template, (await dareView(db, DATA, 'cole', NOW)).body, DATA.dares);
  assert.ok(cole.includes('<p>Professor Cole declined</p>') && !cole.includes('taken it</span>') && !cole.includes('dare-rival'));
  const hostile = { ...(await dareView(db, DATA, 'acme', NOW)).body, org: '<b>Evil</b>', address: 'Mr. "X"' };
  const evil = darePage(template, hostile, DATA.dares);
  assert.ok(!evil.includes('<b>Evil</b>') && evil.includes('&lt;b&gt;Evil&lt;/b&gt;') && evil.includes('Mr. &quot;X&quot;: no score yet'));
  assert.equal(statusLine(dareOf('bolt'), { html: false }), 'Mr. Bolt: 640, posted 12 October 2026');
  assert.equal(fmtDate('2026-01-05'), '5 January 2026');
  assert.equal(dareShareText({ ...dareOf('acme'), pronoun: 'he' }, -228, 'whosbluffing.com'), "I scored -228 on the ten questions written for Ada Acme. He hasn't taken it yet. whosbluffing.com/dare/acme");
  assert.equal(HEADERS['content-security-policy'].includes("script-src 'self'"), true);
});

test('end screen: the finished-dare line', () => {
  assert.equal(dareDone(640), 'You have taken this round: 640 points.');
  assert.equal(dareDone(-228), 'You have taken this round: −228 points.');
});

// The real file: the seed's rules hold, every dare on the board has ten pairs that pass the picker's rules, and the
// bundle the Functions import is the board.
test('real dares/dares.json: valid seed; every filled dare passes the rules; functions/_dares.json is the board', () => {
  const read = (u) => JSON.parse(readFileSync(new URL(u, import.meta.url), 'utf8'));
  const [pool, doc, rounds, dares, bundle] = ['../../items/pool.json', '../../items/pairs.json', '../../daily/rounds.json', '../../dares/dares.json', '../functions/_dares.json'].map(read);
  assert.deepEqual(seedErrors(dares), []);
  const ctx = dareContext({ pool, doc, rounds, data: loadRounds(serverPool(pool), compactPairs(doc), rounds) });
  const r = buildDares(dares, ctx);
  assert.deepEqual(r.errors, []);
  assert.deepEqual(r.dares, dares, 'nothing left to pick that could be picked');
  assert.deepEqual(r.compact, bundle);
  for (const d of dares.filter((x) => x.items?.length)) assert.deepEqual(pinnedErrors(d, ctx), [], d.slug);
  assert.ok(bundle.some((d) => d.slug === 'altman'), 'the smoke test plays dr-altman');
});

// --- members of Congress (the Politics pack's dares) --------------------------------------------------------------------
const member = (slug, party, extra = {}) => seed(slug, { party, bioguide: 'A000001', org: 'the Senate', topic: 'Congress', address: `Senator ${slug}`, ...extra });

test('members of Congress: party, caucus and bioguide rules; the board shows them in equal numbers per party', () => {
  assert.deepEqual(seedErrors([member('one', 'green'), member('two', 'independent'), member('three', 'democrat', { caucus: 'democrat' }),
    member('four', 'republican', { bioguide: undefined }), member('five', 'independent', { caucus: 'green' }), member('six', 'democrat', { bioguide: 'o000172' })])
    .map((e) => e.split(':')[0]), ['one', 'two', 'three', 'four', 'five', 'six']);
  assert.deepEqual(seedErrors([member('seven', 'independent', { caucus: 'democrat' }), member('eight', 'republican'), seed('nine')]), []);
  assert.deepEqual([sideOf(member('i', 'independent', { caucus: 'democrat' })), sideOf(member('r', 'republican')), sideOf(seed('x'))], ['democrat', 'republican', undefined]);
  const filled = (slug, party, extra) => ({ ...member(slug, party, extra), items: ['p00001'] });
  const board = [seed('acme', { items: ['p00001'] }), filled('d1', 'democrat'), filled('i1', 'independent', { caucus: 'democrat' }), filled('r1', 'republican')];
  const { shown, waiting } = balanced(board);
  assert.deepEqual([shown.map((d) => d.slug), waiting.map((d) => d.slug)], [['acme', 'd1', 'r1'], ['i1']]);
  assert.deepEqual(balanced(board.slice(0, 3)).waiting.map((d) => d.slug), ['d1', 'i1'], 'no Republican filled: no member on the board');
  // Through the build: two Democrats fill (keyword Acme), the Republican cannot, so both Democrats wait; the rest is unchanged.
  const r = buildDares([seed('acme'), member('dem', 'democrat'), member('dem-two', 'democrat'), member('rep', 'republican', { keywords: ['Globex'] })], CTX);
  assert.deepEqual(r.errors, []);
  assert.deepEqual(r.compact.map((d) => d.slug), ['acme']);
  assert.deepEqual(r.unfilled.map((u) => [u.slug, u.reason.split(' ')[0]]), [['rep', 'no'], ['dem', 'filled,'], ['dem-two', 'filled,']]);
  assert.ok(r.dares.find((d) => d.slug === 'dem').items.length === 10, 'the waiting dare keeps its picks');
});

test('pages: a member of Congress gets ten questions about Congress (`topic`), addressed by chamber', async () => {
  const template = readFileSync(new URL('../scripts/page.html', import.meta.url), 'utf8');
  const db = openD1();
  const v = { ...(await dareView(db, DATA, 'cole', NOW)).body, slug: 'cruz', name: 'Ted Cruz', address: 'Senator Cruz', org: 'the Senate' };
  const page = darePage(template, v, new Map([['cruz', { topic: 'Congress' }]]));
  assert.ok(page.includes('<h1 id="hero-title">Ten questions about Congress, written for Senator Cruz</h1>'));
  assert.ok(page.includes('<p>Senator Cruz declined</p>'));
});

// The real file's members: who they are was checked on congress.gov (current members, 2026-10-05) and their X accounts
// on Wikidata (web/NOTES.md); this checks the shape the coordinator asked for.
test('real dares/dares.json: 24 members of Congress, 12 per side, addressed by chamber, the rival from the other side', () => {
  const dares = JSON.parse(readFileSync(new URL('../../dares/dares.json', import.meta.url), 'utf8'));
  const members = dares.filter((d) => d.party);
  assert.equal(members.length, 24);
  assert.deepEqual(SIDES.map((side) => members.filter((d) => sideOf(d) === side).length), [12, 12]);
  const by = new Map(dares.map((d) => [d.slug, d]));
  for (const d of members) {
    const chamber = d.org === 'the Senate' ? 'Senate' : 'House';
    assert.ok(['the Senate', 'the House'].includes(d.org), d.slug);
    assert.equal(d.address, `${chamber === 'Senate' ? 'Senator' : 'Representative'} ${d.keywords[0]}`, d.slug);
    assert.deepEqual([d.topic, d.pack, d.difficulty, d.keywords.length, d.keywords[2], d.status, d.dare_url], ['Congress', 'politics', 'normal', 3, chamber, 'open', null], d.slug);
    assert.ok(d.name.endsWith(` ${d.keywords[0]}`) && /^[A-Za-z_]{1,15}$/.test(d.handle), d.slug);
    const rival = by.get(d.rival);
    assert.ok(rival?.party && sideOf(rival) !== sideOf(d), `${d.slug}: a rival from the other side`);
    assert.ok(rival.keywords[1] === d.keywords[1] || rival.org === d.org, `${d.slug}: the rival shares the state or the chamber`);
  }
  assert.equal(new Set(members.map((d) => d.handle.toLowerCase())).size, 24);
});

test('pages: the portrait (64 px by the status line, 32 on the board) or the initials, grey until played; the photo credits', async () => {
  const template = readFileSync(new URL('../scripts/page.html', import.meta.url), 'utf8');
  const db = openD1();
  const official = { source_url: 'https://commons.wikimedia.org/wiki/File:Bo_Bolt.jpg', author: OFFICIAL, license: 'public domain' };
  const extra = { acme: { avatar: '/img/dares/acme.jpg', credit: CREDIT }, bolt: { avatar: '/img/dares/bolt.jpg', credit: official } };
  const dares = new Map([...DATA.dares].map(([slug, d]) => [slug, { ...d, ...extra[slug] }]));
  const page = async (slug, map = dares) => darePage(template, (await dareView(db, DATA, slug, NOW)).body, map);
  const acme = await page('acme'); // open: grey and tilted (no is-played)
  assert.ok(acme.includes('<div class="card dare-status"><img class="dare-face" src="/img/dares/acme.jpg" alt="Ada Acme" width="64" height="64"><div><p>Ms. Acme: no score yet</p>'));
  const ccLine = '<li>Ada Acme: <a href="https://commons.wikimedia.org/wiki/File:Portrait.jpg" rel="noopener noreferrer">photo</a> by A. Photographer (cropped), '
    + '<a href="https://creativecommons.org/licenses/by-sa/4.0/" rel="license noopener noreferrer">CC BY-SA 4.0</a></li>';
  assert.ok(acme.includes(`<p class="fine">Public figures only.`) && acme.includes(`<div class="dare-credits fine"><p>Photo credits</p><ul>${ccLine}</ul></div>`));
  assert.ok(acme.indexOf('dare-credits') > acme.indexOf('Public figures only.'), 'at the bottom, after the opt-out line');
  const bolt = await page('bolt'); // played: full colour, straight
  assert.ok(bolt.includes('<img class="dare-face is-played" src="/img/dares/bolt.jpg" alt="Bo Bolt" width="64" height="64"><div><p>Mr. Bolt: 640,'));
  assert.ok(bolt.includes('<ul><li>Official portrait: U.S. Congress, public domain</li></ul>'));
  const cole = await page('cole'); // declined, no portrait: initials, grey; nothing to credit
  assert.ok(cole.includes('<div class="card dare-status"><span class="dare-face dare-mono" role="img" aria-label="Cy Cole">CC</span><div><p>Professor Cole declined</p>'));
  assert.ok(!cole.includes('dare-credits'));
  const board = boardPage(template, (await boardView(db, DATA, NOW)).body, dares);
  assert.ok(board.includes('<th scope="row"><img class="dare-face dare-face-sm" src="/img/dares/acme.jpg" alt="Ada Acme" width="32" height="32" loading="lazy"><a href="/dare/acme">Ada Acme</a></th>'));
  assert.ok(board.includes('<th scope="row"><img class="dare-face dare-face-sm is-played" src="/img/dares/bolt.jpg" alt="Bo Bolt" width="32" height="32" loading="lazy"><a href="/dare/bolt">Bo Bolt</a></th>'));
  assert.ok(board.includes('<th scope="row"><span class="dare-face dare-face-sm dare-mono" role="img" aria-label="Cy Cole">CC</span><a href="/dare/cole">Cy Cole</a></th>'));
  assert.ok(board.includes(`<div class="dare-credits fine"><p>Photo credits</p><ul>${ccLine}<li>Official portrait: U.S. Congress, public domain</li></ul></div>`));
  assert.ok(board.indexOf('dare-credits') > board.indexOf('</table>'), 'under the table');
  const allOfficial = new Map([...dares].map(([slug, d]) => [slug, { ...d, avatar: `/img/dares/${slug}.jpg`, credit: official }]));
  const plural = boardPage(template, (await boardView(db, DATA, NOW)).body, allOfficial);
  assert.ok(plural.includes('<ul><li>Official portraits: U.S. Congress, public domain</li></ul>'), 'public-domain portraits share one line');
  const none = boardPage(template, (await boardView(db, DATA, NOW)).body, DATA.dares);
  assert.ok(!none.includes('dare-credits') && none.includes('aria-label="Ada Acme">AA</span>'), 'no portraits: initials only, no credits');
  const hostile = new Map([...dares].map(([slug, d]) => [slug, { ...d, credit: { source_url: 'https://x.example/"><b>', author: '<i>Evil</i>', license: 'CC BY 2.0' } }]));
  const evil = await page('acme', hostile);
  assert.ok(evil.includes('<a href="https://x.example/&quot;&gt;&lt;b&gt;" rel="noopener noreferrer">photo</a> by &lt;i&gt;Evil&lt;/i&gt; (cropped)') && !evil.includes('<i>Evil</i>'));
  for (const h of [acme, bolt, cole, board]) assert.doesNotMatch(h, /\sstyle=|<style/i, 'no inline style (CSP)');
  assert.ok(darePage(template, { ...(await dareView(db, DATA, 'cole', NOW)).body, name: 'Alexandria Ocasio-Cortez' }, dares).includes('>AO</span>'), 'initials: first and last word');
});

// The real portraits: one per dare except the four with no usable free photo (web/NOTES.md), each a 160 x 160 JPEG under
// 25 KB in public/img/dares, members of Congress by their official portrait, every file referenced.
const jpegSize = (buf) => { // [width, height] from the first SOF marker
  for (let i = 2; i + 9 < buf.length; i += 2 + buf.readUInt16BE(i + 2)) if (buf[i + 1] >= 0xc0 && buf[i + 1] <= 0xc3) return [buf.readUInt16BE(i + 7), buf.readUInt16BE(i + 5)];
  return null;
};
test('real dares/dares.json: every portrait file exists, 160 x 160, under 25 KB; members by official portrait; four by initials', () => {
  const dares = JSON.parse(readFileSync(new URL('../../dares/dares.json', import.meta.url), 'utf8'));
  assert.deepEqual(dares.filter((d) => !d.avatar).map((d) => d.slug), ['karpathy', 'kilpatrick', 'clark', 'mollick']);
  for (const d of dares.filter((x) => x.avatar)) {
    const file = new URL(`../public${d.avatar}`, import.meta.url);
    assert.ok(statSync(file).size < 25 * 1024, `${d.slug}: ${statSync(file).size} bytes`);
    assert.deepEqual(jpegSize(readFileSync(file)), [160, 160], d.slug);
    assert.match(d.credit.source_url, /^https:\/\/commons\.wikimedia\.org\/wiki\/File:\S+$/, d.slug);
    assert.equal(d.credit.author === OFFICIAL && d.credit.license === 'public domain', Boolean(d.party), `${d.slug}: official portraits are the members'`);
  }
  assert.deepEqual(readdirSync(new URL('../public/img/dares/', import.meta.url)).sort(), dares.filter((d) => d.avatar).map((d) => `${d.slug}.jpg`).sort(), 'no stray file');
});
