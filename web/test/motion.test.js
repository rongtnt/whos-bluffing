// The game's personality and motion: the end screen's result grid and detail cards, the reduced-motion fallback class
// on everything that moves, the reaction lines (buckets, no repeats, mild mode) and the sound module's no-op.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { resultGrid, detailCard } from '../public/round-end.js';
import { scoreChart } from '../public/rounds.js';
import { MOTION } from '../public/motion.js';
import { REACTIONS, reactionBucket, pickReaction, linesOf, streak, bestLine } from '../public/reactions.js';
import { createSound } from '../public/sound.js';

const PUBLIC = new URL('../public/', import.meta.url);
const read = (f) => readFileSync(new URL(f, PUBLIC), 'utf8');
const en = JSON.parse(read('i18n/en.json'));
const t = (key, vars = {}) => key.split('.').reduce((o, k) => o?.[k], en).replace(/\{(\w+)\}/g, (m, k) => (k in vars ? vars[k] : m));
const seeded = (seed) => { let s = seed; return () => ((s = (s * 1103515245 + 12345) % 2147483648) / 2147483648); };

// A finished round of ten: question k compares "Alpha k" with "Beta k"; odd questions are missed.
const ROUND = {
  items: Array.from({ length: 10 }, (_, k) => ({ id: `p${String(k + 1).padStart(5, '0')}`, prompt: `Which is longer, question ${k + 1}?`, a: `Alpha ${k}`, b: `Beta ${k}` })),
  answers: {},
};
ROUND.items.forEach((it, k) => {
  const correct = k % 2 === 0;
  ROUND.answers[it.id] = { choice: k % 3 === 0 ? 1 : 0, conf: [50, 60, 70, 80, 90, 100][k % 6], correct, points: correct ? 84 - k : -156 + k,
    truth: { a_value: 1000 + k, b_value: 2000 + k, unit: 'km', a_source: `https://www.wikidata.org/wiki/Q${k}a`, b_source: `https://www.wikidata.org/wiki/Q${k}b` },
    line: `Line ${k}` };
});
const elementsWithClass = (htmlText) => [...htmlText.matchAll(/<[a-z][^>]*\bclass="([^"]*)"[^>]*>/g)].map((m) => m[1].split(/\s+/));

test('detail card: square k opens question k, with the pick, the confidence, both true values, sources, points and line', () => {
  for (let k = 0; k < ROUND.items.length; k += 1) {
    const it = ROUND.items[k];
    const a = ROUND.answers[it.id];
    const card = String(detailCard(ROUND, k, t));
    assert.ok(card.includes(`Question ${k + 1} of 10`), `k=${k}: number`);
    assert.ok(card.includes(it.prompt), `k=${k}: prompt`);
    for (const other of ROUND.items) if (other !== it) assert.ok(!card.includes(`${other.prompt}<`), `k=${k}: shows ${other.prompt}`);
    assert.ok(card.includes(`You picked ${'AB'[a.choice]} · ${a.choice ? it.b : it.a} at ${a.conf}% sure.`), `k=${k}: pick`);
    assert.ok(card.includes(`${(1000 + k).toLocaleString('en-US')} km`) && card.includes(`${(2000 + k).toLocaleString('en-US')} km`), `k=${k}: values`);
    assert.ok(card.includes(a.truth.a_source) && card.includes(a.truth.b_source), `k=${k}: sources`);
    const truthName = (a.correct ? a.choice : 1 - a.choice) ? it.b : it.a;
    assert.ok(card.includes(`<li class="is-true"><span class="name">✓ ${truthName}</span>`), `k=${k}: the right answer is marked`);
    assert.ok(card.includes(`${a.correct ? 'Right' : 'Wrong'} · ${a.points > 0 ? '+' : '−'}${Math.abs(a.points)} pts`), `k=${k}: points`);
    assert.ok(card.includes(`<p class="reaction">Line ${k}</p>`), `k=${k}: line`);
  }
});

test('result grid: one labelled button per question in order; misses shake; each square points at its question', () => {
  const grid = String(resultGrid(ROUND, t));
  const squares = [...grid.matchAll(/<button type="button" class="([^"]+)" data-k="(\d+)" aria-expanded="false" aria-controls="sq-detail" aria-label="([^"]+)">/g)];
  assert.equal(squares.length, 10);
  squares.forEach(([, cls, k, label], i) => {
    assert.equal(Number(k), i);
    const a = ROUND.answers[ROUND.items[i].id];
    assert.equal(cls.split(' ').includes('anim-shake'), !a.correct, `square ${i}`);
    assert.equal(label, `Question ${i + 1}: ${a.correct ? 'Right' : 'Wrong'} at ${a.conf}% sure, ${a.points > 0 ? '+' : '−'}${Math.abs(a.points)} points`);
  });
  assert.match(grid, /<div class="sq-detail card" id="sq-detail" aria-live="polite" hidden><\/div>/);
});

// The CSS rules that declare a keyframe animation, outside the reduced-motion block: [selector list, body].
function animatedRules(css) {
  const outside = css.slice(0, css.lastIndexOf('@media (prefers-reduced-motion: reduce)'));
  const flat = outside.replace(/\/\*[\s\S]*?\*\//g, '').replace(/@keyframes[^{]+\{(?:[^{}]*\{[^{}]*\})*[^{}]*\}/g, '');
  return [...flat.matchAll(/([^{}]+)\{([^{}]*)\}/g)]
    .map((m) => [m[1].replace(/@media[^{]*$/, '').trim(), m[2]])
    .filter(([, body]) => /(?:^|;)\s*animation(?:-name)?\s*:\s*(?!none)/.test(body));
}

test('reduced motion: every animated element carries the fallback class `anim`, and the fallback stops it', () => {
  const css = read('styles.css');
  const rules = animatedRules(css);
  assert.ok(rules.length >= 15, `found ${rules.length} animated rules`);
  for (const [selectors] of rules) {
    for (const sel of selectors.split(',')) assert.match(sel, /\.anim(?![\w-])/, `"${sel.trim()}" animates without the fallback class .anim`);
  }
  const reduced = css.slice(css.lastIndexOf('@media (prefers-reduced-motion: reduce)'));
  assert.match(reduced, /\.anim, \.anim::before, \.anim::after \{ animation: none !important; transition: none !important; \}/);
  assert.match(reduced, /\.anim-stamp, \.confetti \{ display: none !important; \}/);
  for (const cls of Object.keys(MOTION)) assert.ok(css.includes(`.${cls}`), `${cls} has styles`);
  // Markup: static pages and the builders the game renders; anything with a motion class or a pop-able mark has `anim`.
  const pages = readdirSync(PUBLIC, { recursive: true }).filter((f) => f.endsWith('.html')).map(read);
  const stats = { score_hist: Array.from({ length: 41 }, (_, k) => (k === 30 ? 3 : k === 32 ? 1 : 0)), bin_from: -3000, bin_width: 100 };
  const built = [String(resultGrid(ROUND, t)), String(scoreChart(stats, 0, 'Scores'))];
  const marked = [...pages, ...built].flatMap(elementsWithClass).filter((cls) => cls.some((c) => c.startsWith('anim-') || c === 'mark' || c === 'hero-mark'));
  assert.ok(marked.length > 20, `checked ${marked.length} elements`);
  for (const cls of marked) {
    if (cls.includes('mark') && !cls.includes('anim')) continue; // the chat illustrations' static marks never pop
    assert.ok(cls.includes('anim'), `class="${cls.join(' ')}" moves without the fallback class`);
  }
  for (const page of pages.filter((h) => h.includes('<header class="nav">'))) assert.match(page, /<svg class="mark anim" data-mark /);
  const js = ['rounds.js', 'round-end.js', 'motion.js', 'share.js'].map(read).join('\n');
  for (const m of js.matchAll(/class="([^"$]*anim-[^"$]*)"/g)) assert.match(m[1], /(?:^|\s)anim(?:\s|$)/, `rendered class="${m[1]}"`);
});

test('reactions: every bucket has at least 6 lines; at least 40 for right answers and 40 for wrong ones', () => {
  for (const [bucket, lines] of Object.entries(REACTIONS)) assert.ok(lines.length >= 6, `${bucket}: ${lines.length} lines`);
  const total = (prefix) => Object.entries(REACTIONS).filter(([b]) => b.startsWith(prefix)).reduce((n, [, l]) => n + l.length, 0);
  assert.ok(total('right_') >= 40, `right: ${total('right_')}`);
  assert.ok(total('wrong_') >= 40, `wrong: ${total('wrong_')}`);
  const all = Object.values(REACTIONS).flat(2).join(' ');
  assert.doesNotMatch(all, /\b(damn|hell|crap|stupid|idiot|dumb|moron|loser|shit|fuck)\b/i);
  assert.equal(new Set(Object.values(REACTIONS).flat().map((l) => (Array.isArray(l) ? l[0] : l))).size, Object.values(REACTIONS).flat().length, 'no line twice');
});

test('reactions: buckets by stake, streaks of three, a miss after 100%, and the last question', () => {
  const A = (pairs) => pairs.map(([correct, conf]) => ({ correct, conf }));
  assert.equal(reactionBucket(A([[true, 50]]), 0, 10), 'right_coin');
  assert.equal(reactionBucket(A([[true, 60]]), 0, 10), 'right_mid');
  assert.equal(reactionBucket(A([[true, 80]]), 0, 10), 'right_mid');
  assert.equal(reactionBucket(A([[true, 90]]), 0, 10), 'right_sure');
  assert.equal(reactionBucket(A([[false, 50]]), 0, 10), 'wrong_coin');
  assert.equal(reactionBucket(A([[false, 70]]), 0, 10), 'wrong_mid');
  assert.equal(reactionBucket(A([[false, 100]]), 0, 10), 'wrong_sure');
  assert.equal(reactionBucket(A([[true, 70], [true, 70], [true, 70]]), 2, 10), 'streak_right');
  assert.equal(reactionBucket(A([[true, 70], [true, 70], [true, 70], [true, 70]]), 3, 10), 'right_mid');
  assert.equal(reactionBucket(A([[false, 70], [false, 70], [false, 70]]), 2, 10), 'streak_wrong');
  assert.equal(reactionBucket(A([[true, 100], [false, 60]]), 1, 10), 'after_all_in');
  assert.equal(reactionBucket(A([[false, 100], [false, 60], [false, 70]]), 2, 10), 'streak_wrong'); // the streak wins
  assert.equal(reactionBucket(A([[true, 50], [false, 90]]), 1, 2), 'last');
  assert.equal(streak(A([[false, 50], [true, 50], [true, 80]]), 2), 2);
  const said = pickReaction(A([[false, 80]]), 0, 10, new Set(), { rand: () => 0 });
  assert.deepEqual(said, { bucket: 'wrong_mid', template: '{conf}% sure and wrong. Classic.', text: '80% sure and wrong. Classic.' });
  assert.equal(pickReaction(A([[true, 70], [true, 70], [true, 70]]), 2, 10, new Set(), { rand: () => 0.2 }).text, '3 in a row. Are you reading the sources in advance?');
});

test('reactions: no line twice within a round, over many random rounds of ten', () => {
  for (let seed = 1; seed <= 300; seed += 1) {
    const rand = seeded(seed);
    const answers = [];
    const used = new Set();
    for (let k = 0; k < 10; k += 1) {
      answers.push({ correct: rand() < 0.6, conf: [50, 60, 70, 80, 90, 100][Math.floor(rand() * 6)] });
      const said = pickReaction(answers, k, 10, used, { rand, mild: seed % 2 === 0 });
      assert.ok(!used.has(said.template), `seed ${seed}: "${said.template}" twice`);
      used.add(said.template);
    }
  }
});

test('reactions: mild mode swaps every sharp line for its gentler version, and only those', () => {
  let swapped = 0;
  for (const [bucket, lines] of Object.entries(REACTIONS)) {
    const sharp = linesOf(bucket, false);
    const mild = linesOf(bucket, true);
    assert.equal(mild.length, sharp.length, bucket);
    lines.forEach((l, i) => {
      if (Array.isArray(l)) {
        swapped += 1;
        assert.equal(sharp[i], l[0]);
        assert.equal(mild[i], l[1]);
        assert.notEqual(l[0], l[1]);
        assert.ok(!mild.includes(l[0]), `${bucket}: "${l[0]}" survives mild mode`);
      } else {
        assert.equal(mild[i], l, `${bucket}: a plain line changed`);
      }
    });
  }
  assert.ok(swapped >= 15, `${swapped} sharp lines`);
  for (let seed = 1; seed <= 50; seed += 1) {
    const said = pickReaction([{ correct: false, conf: 100 }], 0, 10, new Set(), { mild: true, rand: seeded(seed) });
    assert.ok(!REACTIONS.wrong_sure.filter(Array.isArray).some((l) => l[0] === said.template), said.template);
  }
});

test('reactions: the share text takes the line said after the best-scoring answer', () => {
  assert.equal(bestLine(ROUND.items, ROUND.answers), 'Line 0'); // 84 points, the most
  assert.equal(bestLine(ROUND.items, {}), null);
});

test('sound: a silent no-op without WebAudio; with it, notes only while the speaker is on', () => {
  for (const s of [createSound({ Ctx: undefined }), createSound({ Ctx: null })]) {
    for (const f of ['ding', 'womp', 'tick', 'fanfare']) assert.doesNotThrow(() => s[f](100));
  }
  assert.equal(typeof globalThis.AudioContext, 'undefined');
  assert.doesNotThrow(() => createSound().fanfare()); // node has no AudioContext
  let on = true;
  const started = [];
  class FakeCtx {
    constructor() { this.currentTime = 0; this.state = 'running'; this.destination = {}; }
    createOscillator() { const param = { setValueAtTime() {}, exponentialRampToValueAtTime() {} }; return { frequency: param, connect: (x) => x, start: (t) => started.push(t), stop() {} }; }
    createGain() { const param = { setValueAtTime() {}, exponentialRampToValueAtTime() {} }; return { gain: param, connect: (x) => x }; }
  }
  const s = createSound({ isOn: () => on, Ctx: FakeCtx });
  s.ding(100);
  s.womp(100);
  s.tick();
  s.fanfare();
  assert.equal(started.length, 2 + 1 + 1 + 4);
  on = false;
  s.ding(50);
  assert.equal(started.length, 8, 'muted: no notes');
});

test('brand mark: the share card draws the five-piece question mark, and no five-squares-in-a-row logo is left', async () => {
  const { drawMark, MARK_PIECES } = await import('../public/share.js');
  const ops = [];
  const g = {
    save: () => ops.push(['save']), restore: () => ops.push(['restore']), translate: (x, y) => ops.push(['translate', x, y]),
    scale: (x) => ops.push(['scale', x]), rotate: (a) => ops.push(['rotate', Math.round((a * 180) / Math.PI)]), beginPath() {},
    roundRect: (...a) => ops.push(['rect', ...a]), fill: () => ops.push(['fill', g.fillStyle]),
  };
  const w = drawMark(g, 10, 20, 60, '#111827', '#2F5BFF');
  assert.equal(w, 28);
  assert.deepEqual(ops.filter((o) => o[0] === 'rect').map((o) => o.slice(1)), MARK_PIECES.map(([x, y, pw, ph, r]) => [x, y, pw, ph, r]));
  assert.deepEqual(MARK_PIECES.map((p) => p.slice(0, 5)), [[0, 0, 28, 10, 3], [18, 12.2, 10, 12, 3], [10.5, 24.5, 16, 10, 3], [9, 36.5, 10, 8, 3], [9.6, 48.5, 8.8, 8.8, 2.5]]);
  assert.deepEqual(ops.filter((o) => o[0] === 'rotate').map((o) => o[1]), [-52, 45]); // the elbow and the dot
  assert.deepEqual(ops.filter((o) => o[0] === 'fill').map((o) => o[1]), ['#111827', '#111827', '#111827', '#111827', '#2F5BFF']);
  const share = read('share.js');
  assert.doesNotMatch(share, /i < 5|COLORS\.(hit|miss)/, 'the old five-square drawing is gone');
  const pages = readdirSync(PUBLIC, { recursive: true }).filter((f) => f.endsWith('.html')).map(read);
  for (const h of pages) assert.doesNotMatch(h, /viewBox="0 0 76 12"|class="hero-mark anim" data-mark aria-hidden="true"><i>/, 'an old five-square mark');
  for (const f of ['og.html', 'logo.html']) assert.doesNotMatch(readFileSync(new URL(`../design/${f}`, import.meta.url), 'utf8'), /class="squares"|viewBox="0 0 76 12"/, f);
  assert.equal(read('favicon.svg').trim(), readFileSync(new URL('../../brand/icon.svg', import.meta.url), 'utf8').trim());
  const challengeTemplate = JSON.parse(readFileSync(new URL('../functions/_page.json', import.meta.url), 'utf8')).html; // the challenge page's chrome
  assert.ok(challengeTemplate.includes('<svg class="mark anim" data-mark viewBox="0 0 28 60"') && !challengeTemplate.includes('viewBox="0 0 76 12"'));
  for (const h of pages.filter((x) => x.includes('<header class="nav">'))) assert.match(h, /<a class="brand" href="\/"><span>Who's Bluffing<span class="sr-only">\?<\/span><\/span><svg class="mark anim" data-mark viewBox="0 0 28 60"/);
});
