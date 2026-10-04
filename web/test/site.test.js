// Static site checks: the Markdown converter behind /privacy, /terms and /docs/api; every page's head, shared header
// and footer, sitemap entry and CSP-safe markup; the MAU definition on /research; the social-proof threshold on /.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { markdown, inline, renderPage, DOCS } from '../scripts/sync-docs.js';
import { proofTiles, MIN_PLAYERS } from '../public/home.js';

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
  const page = renderPage(DOCS[0], '# Privacy', '<title>{{title}}</title><link href="https://howsure.me{{path}}">{{main}} $& {{path}}');
  assert.match(page, /^<title>Privacy \| HowSure<\/title><link href="https:\/\/howsure.me\/privacy"><article/);
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
    else want(new RegExp(`<link rel="canonical" href="https://howsure.me${pathOf(file)}">`), 'canonical');
    want(/<meta property="og:image" content="https:\/\/howsure.me\/og.png">/, 'og:image');
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
  const listed = [...read(new URL('sitemap.xml', PUBLIC)).matchAll(/<loc>https:\/\/howsure\.me(\/[^<]*)<\/loc>/g)].map((m) => m[1]).sort();
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
