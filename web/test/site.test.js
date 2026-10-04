// Static site checks: the Markdown converter behind /privacy, /terms and /docs/api; every page's head, shared header
// and footer, sitemap entry and CSP-safe markup; the MAU definition on /research; the social-proof threshold on /.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { markdown, inline, renderPage, DOCS } from '../scripts/sync-docs.js';
import { proofTiles, MIN_PLAYERS, MIN_ROOM, roomView, roomChart, receipt, EXAMPLE_ROOM, EXAMPLE_BLUFFS } from '../public/home.js';
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

test('social proof: nothing below 100 monthly players; tiles leave out numbers that are missing', () => {
  const kpi = { mau: MIN_PLAYERS, communities: { workspaces: 3, guilds: 2, rooms: 0, classrooms: 1 } };
  assert.equal(proofTiles({ ...kpi, mau: MIN_PLAYERS - 1 }, null, null), null);
  assert.equal(proofTiles(null, null, null), null);
  assert.deepEqual(proofTiles(kpi, { n_countries: 1234 }, { players: 4040 }),
    [['100', 'monthly players'], ['1,234', 'countries'], ['6', 'communities'], ['4,040', 'played today’s ranked round']]);
  assert.deepEqual(proofTiles({ ...kpi, mau: 2500 }, null, { players: 0 }).map(([, label]) => label), ['monthly players', 'communities']);
});

test('live panel: the room chart from 20 players (today, else yesterday, else the grey example), stamped receipts, five type tiles', () => {
  assert.equal(MIN_ROOM, 20);
  const calibration = [50, 60, 70, 80, 90, 100].map((conf, k) => ({ conf, n: k ? 10 * k : 0, right: 4 * k }));
  assert.equal(roomView(null, null), null); // the stats request failed: the page keeps its example
  assert.equal(roomView({ players: 19, calibration }, { players: 19, calibration }), null);
  assert.deepEqual(roomView({ players: 1204, calibration }, null), { points: calibration, cap: 'Today’s room · 1,204 played', live: true });
  assert.deepEqual(roomView({ players: 3, calibration: [] }, { players: 25, calibration }), { points: calibration, cap: 'Yesterday’s room · 25 played', live: false });
  const chart = String(roomChart(calibration));
  assert.equal(chart.match(/<circle /g).length, 5, 'one dot per confidence with answers');
  assert.match(chart, /^<svg class="room-chart" viewBox="0 0 200 160" role="img"/);
  assert.match(chart, /<path class="room-ideal" d="M40 73L192 8"\/>/, 'the diagonal from 50% sure, 50% right to 100%, 100%');
  assert.match(String(roomChart(EXAMPLE_ROOM, { example: true })), /^<svg class="room-chart is-example"/);
  assert.equal(String(receipt({ prompt: 'Which came first?', pick: 'Tesla & Co', conf: 100, points: -300 })),
    '<li class="receipt"><span class="receipt-q">Which came first?</span><span class="receipt-pick"><s>Tesla &amp; Co</s><b>−300</b></span><span class="stamp stamp-bluff" data-stake="100">BLUFF</span></li>');
  const home = read(new URL('index.html', PUBLIC));
  assert.ok(home.includes(`<div class="room-box" data-room-chart>${roomChart(EXAMPLE_ROOM, { example: true })}</div>`), 'the static example chart is the builder\'s');
  assert.ok(home.includes(`<ol class="receipts is-example" data-receipts>${EXAMPLE_BLUFFS.map(receipt).join('')}</ol>`), 'the static example receipts are the builder\'s');
  assert.equal([...home.matchAll(/<figcaption class="live-cap" data-(?:room|receipts)-cap>Example<\/figcaption>/g)].length, 2);
  assert.deepEqual([...home.matchAll(/<button type="button" class="type-tile" data-type="[a-z-]+" aria-pressed="false"><svg [^>]+><path d="[^"]+"\/><\/svg><span>([^<]+)<\/span><span class="type-band" aria-hidden="true">(?:<i><\/i>){5}<\/span><span class="type-tip">[^<]+<\/span><\/button>/g)].map((m) => m[1]), TYPES.map(typeName)); // the names players read (public/types.js)
});
