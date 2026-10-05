// Static site checks: the Markdown converter behind /privacy, /terms and /docs/api; every page's head, shared header
// and footer, sitemap entry and CSP-safe markup; the MAU definition on /research; the home page's copy and sections;
// no count of players on the home, /stats or /status; the live panel on /stats and the FAQ on /support.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { markdown, inline, renderPage, DOCS } from '../scripts/sync-docs.js';
import * as home from '../public/home.js';
import { MIN_ROOM, roomView, roomChart, receipt, EXAMPLE_ROOM, EXAMPLE_BLUFFS } from '../public/home.js';
import { TYPES } from '../functions/_rounds.js';
import { typeName } from '../public/types.js';

const PUBLIC = new URL('../public/', import.meta.url);
const read = (u) => readFileSync(u, 'utf8');
const pages = readdirSync(PUBLIC, { recursive: true }).filter((f) => f.endsWith('.html')).sort();
const pathOf = (file) => `/${file.replace(/\.html$/, '').replace(/^index$/, '')}`;
const block = (htmlText, re) => htmlText.match(re)?.[0];
const HEADER = /<header class="nav">[\s\S]*?<\/header>/;
const FOOTER = /<footer class="site-foot">[\s\S]*?<\/footer>/;

test('markdown: headings with ids, paragraphs, lists, bold, safe links; code and text are escaped', () => {
  const md = '# Daily API\n\nBase: `https://<host>/api` & **bold** text\nwrapped line.\n\n- one [docs](/docs/api)\n- two [x](javascript:void)\n\n1. first\n2. second';
  assert.equal(markdown(md), [
    '<h1 id="daily-api">Daily API</h1>',
    '<p>Base: <code>https://&lt;host&gt;/api</code> &amp; <strong>bold</strong> text wrapped line.</p>',
    '<ul>\n<li>one <a href="/docs/api">docs</a></li>\n<li>two x</li>\n</ul>',
    '<ol>\n<li>first</li>\n<li>second</li>\n</ol>',
  ].join('\n'));
  assert.equal(inline('`**not bold**` and <b>'), '<code>**not bold**</code> and &lt;b&gt;');
  const page = renderPage(DOCS[0], '# Privacy', '<title>{{title}}</title><link href="https://whosbluffing.com{{path}}">{{main}} $& {{path}}');
  assert.match(page, /^<title>Privacy \| Who's Bluffing\?<\/title><link href="https:\/\/whosbluffing.com\/privacy"><article/);
  assert.match(page, /<\/article> \$& \/privacy$/); // "$&" in the template is not a replacement pattern
});

test('every page: title, description, canonical, Open Graph, icons, theme colours, shared header and footer', () => {
  const template = read(new URL('../scripts/page.html', import.meta.url));
  assert.ok(pages.length >= 15, `only ${pages.length} pages`);
  for (const file of pages) {
    const h = read(new URL(file, PUBLIC));
    const want = (re, what) => assert.match(h, re, `${file}: ${what}`);
    want(/<title>[^<{]{10,}<\/title>/, 'title');
    want(/<meta name="description" content="[^"{]{20,}">/, 'description');
    if (file === '404.html') want(/<meta name="robots" content="noindex">/, 'noindex');
    else want(new RegExp(`<link rel="canonical" href="https://whosbluffing.com${pathOf(file)}">`), 'canonical');
    want(/<meta property="og:image" content="https:\/\/whosbluffing.com\/og.png">/, 'og:image');
    want(/<meta name="twitter:card" content="summary_large_image">/, 'twitter card');
    want(/<link rel="icon" href="\/favicon.svg" type="image\/svg\+xml">/, 'favicon');
    want(/<link rel="apple-touch-icon" href="\/apple-touch-icon.png">/, 'touch icon');
    want(/<meta name="theme-color" content="#FBFAF7" media="\(prefers-color-scheme: light\)">/, 'theme-color');
    want(/<script src="\/site.js"><\/script>\n(<script type="module" src="\/app.js"><\/script>\n)?<\/head>/, 'site.js in head');
    assert.equal(block(h, HEADER), block(template, HEADER), `${file}: header differs from scripts/page.html`);
    assert.equal(block(h, FOOTER), block(template, FOOTER), `${file}: footer differs from scripts/page.html`);
  }
});

test('markup is CSP-safe (no inline scripts, styles or handlers) and every page is in the sitemap', () => {
  for (const file of pages) {
    const h = read(new URL(file, PUBLIC));
    assert.doesNotMatch(h, /<script(?![^>]*\bsrc=)[^>]*>/, `${file}: inline script`);
    assert.doesNotMatch(h, /\sstyle=|<style|\son[a-z]+=/i, `${file}: inline style or event handler`);
  }
  const listed = [...read(new URL('sitemap.xml', PUBLIC)).matchAll(/<loc>https:\/\/whosbluffing\.com(\/[^<]*)<\/loc>/g)].map((m) => m[1]).sort();
  const expected = pages.filter((f) => f !== '404.html').map(pathOf).sort();
  assert.deepEqual(listed, expected);
});

test('/research quotes the MAU and community definitions from PREREG word for word', () => {
  const prereg = read(new URL('../../prereg/PREREG.md', import.meta.url)).replace(/\*\*/g, '');
  const research = read(new URL('research.html', PUBLIC));
  assert.ok(research.includes(`<p>${prereg.match(/^- (MAU: .*)$/m)[1]}</p>`), 'MAU definition');
  assert.ok(research.includes(`<p>${prereg.match(/^- (Communities: .*)$/m)[1]}</p>`), 'Communities definition');
});

test('no social proof: the home, /stats and /status never print a count of players; usage stays private', () => {
  const index = read(new URL('index.html', PUBLIC));
  assert.ok(!index.includes('data-played') && !('playedLine' in home) && !('renderPlayed' in home));
  for (const f of ['home.js', 'stats.js', 'status.js', 'app.js']) {
    const js = read(new URL(f, PUBLIC));
    assert.ok(!js.includes('/api/kpi'), `${f} reads /api/kpi`);
    assert.doesNotMatch(js, /played today|num\(d\.n_|players: num|total_play/, f);
  }
  const status = read(new URL('status.html', PUBLIC));
  for (const gone of ['data-kpi', 'monthly players', 'daily players', 'communities', 'rounds played']) assert.ok(!status.includes(gone), `status: ${gone}`);
  const en = JSON.parse(read(new URL('i18n/en.json', PUBLIC)));
  for (const k of ['ranked_row', 'row']) assert.doesNotMatch(en.stats[k], /\{(players|n)\}/, k);
  assert.doesNotMatch(en.rounds.board_line, /\{players\}/);
  assert.ok(!('rank_of' in en.rounds) && !('global' in en.results));
});

// Visible text of a page: no head, scripts, comments or tags.
const visible = (h) => h.replace(/<head>[\s\S]*?<\/head>|<!--[\s\S]*?-->|<svg[\s\S]*?<\/svg>|<!doctype html>/gi, ' ').replace(/<[^>]+>/g, ' ');
const words = (text) => text.trim().split(/\s+/).length;

test('home page: one headline and short copy per section, in the house register; the old sections are gone', () => {
  const home = read(new URL('index.html', PUBLIC));
  assert.match(home, /<h1 id="hero-title">Who's <span class="h1-accent">bluffing<\/span>\?<\/h1>/);
  assert.match(home, /<p class="hero-sub">[^<]+<\/p>\n {6}<p class="hero-note">Every answer comes with a source, so you learn as you play\.<\/p>/);
  assert.equal([...home.match(/<div class="home-copy">[\s\S]*?<div class="actions">/)[0].matchAll(/<p /g)].length, 2, 'the hero copy: the sentence and the note');
  assert.match(home, /<button class="primary" id="play" type="button" data-play>/);
  const budgets = [ // [paragraph, at most this many words]
    [/<p class="hero-sub">([^<]+)<\/p>/, 16], [/id="reveal-title">[^<]+<\/h2>\s*<p>([^<]+)<\/p>/, 30],
    [/id="packs-title">[^<]+<\/h2>\s*<p>([^<]+)<\/p>/, 25], [/questions, each with a source<\/h2>\s*<p>([^<]+)<\/p>/, 20],
    [/id="start-title">[^<]+<\/h2>\s*<p>([^<]+)<\/p>/, 20],
  ];
  for (const [re, most] of budgets) {
    const text = home.match(re)?.[1];
    assert.ok(text && words(text) <= most, `"${text}" is over ${most} words`);
  }
  assert.equal([...home.matchAll(/<h2 id="[a-z]+-title">/g)].length, 4);
  const text = visible(home.replace(/<!-- prompts -->[\s\S]*<!-- \/prompts -->/, '')); // the prompts are the game's data, not copy
  assert.doesNotMatch(text, /calibrat|open source|—|!|\b(first|largest|best)\b/i);
  for (const gone of ['class="live"', 'id="faq"', 'id="how"', 'id="ways"', 'id="open"', 'id="proof"', 'premium']) assert.ok(!home.includes(gone), gone);
});

test('the FAQ lives on /support under "Answers that may help", and nothing links to /#faq any more', () => {
  const support = read(new URL('support.html', PUBLIC));
  assert.match(support, /<h2 id="faq">Answers that may help<\/h2>\n {2}<div class="faq">(\n {4}<details><summary>[^<]+<\/summary><p>[\s\S]+?<\/p><\/details>){8}\n {2}<\/div>/);
  for (const file of pages) assert.ok(!read(new URL(file, PUBLIC)).includes('href="/#faq"'), file);
});

test('live panel (the first section of /stats): the room chart from 20 players (today, else yesterday, else the grey example), stamped receipts, five type tiles', () => {
  assert.equal(MIN_ROOM, 20);
  const calibration = [50, 60, 70, 80, 90, 100].map((conf, k) => ({ conf, n: k ? 10 * k : 0, right: 4 * k }));
  assert.equal(roomView(null, null), null); // the stats request failed: the page keeps its example
  assert.equal(roomView({ players: 19, calibration }, { players: 19, calibration }), null);
  assert.deepEqual(roomView({ players: 1204, calibration }, null), { points: calibration, cap: 'Today’s room', live: true });
  assert.deepEqual(roomView({ players: 3, calibration: [] }, { players: 25, calibration }), { points: calibration, cap: 'Yesterday’s room', live: false });
  const chart = String(roomChart(calibration));
  assert.equal(chart.match(/<circle /g).length, 5, 'one dot per confidence with answers');
  assert.match(chart, /^<svg class="room-chart" viewBox="0 0 200 160" role="img"/);
  assert.match(chart, /<path class="room-ideal" d="M40 73L192 8"\/>/, 'the diagonal from 50% sure, 50% right to 100%, 100%');
  assert.match(String(roomChart(EXAMPLE_ROOM, { example: true })), /^<svg class="room-chart is-example"/);
  assert.equal(String(receipt({ prompt: 'Which came first?', pick: 'Tesla & Co', conf: 100, points: -300 })),
    '<li class="receipt"><span class="receipt-q">Which came first?</span><span class="receipt-pick"><s>Tesla &amp; Co</s><b>−300</b></span><span class="stamp stamp-bluff" data-stake="100">BLUFF</span></li>');
  const stats = read(new URL('stats.html', PUBLIC));
  assert.match(stats, /<main id="main">\n<div class="stats-top">\n {2}<h1>Live stats<\/h1>\n {2}<section class="live" aria-labelledby="live-title" data-live>/);
  assert.ok(stats.indexOf('data-live') < stats.indexOf('<div id="app">'));
  assert.ok(stats.includes(`<div class="room-box" data-room-chart>${roomChart(EXAMPLE_ROOM, { example: true })}</div>`), 'the static example chart is the builder\'s');
  assert.ok(stats.includes(`<ol class="receipts is-example" data-receipts>${EXAMPLE_BLUFFS.map(receipt).join('')}</ol>`), 'the static example receipts are the builder\'s');
  assert.equal([...stats.matchAll(/<figcaption class="live-cap" data-(?:room|receipts)-cap>Example<\/figcaption>/g)].length, 2);
  assert.deepEqual([...stats.matchAll(/<button type="button" class="type-tile" data-type="[a-z-]+" aria-pressed="false"><svg [^>]+><path d="[^"]+"\/><\/svg><span>([^<]+)<\/span><span class="type-band" aria-hidden="true">(?:<i><\/i>){5}<\/span><span class="type-tip">[^<]+<\/span><\/button>/g)].map((m) => m[1]), TYPES.map(typeName)); // the names players read (public/types.js)
});
