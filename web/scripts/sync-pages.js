// Fills the generated parts of the committed pages (sync-items.js runs this after the items are checked):
//   public/index.html     <!-- questions -->N+<!-- /questions -->, the servable pairs rounded down to the thousand,
//                         <!-- packs -->…<!-- /packs -->, the pack chips: a pack shows when some difficulty can fill it, and
//                         <!-- prompts -->…<!-- /prompts -->, 24 real prompts for the question list (items/pairs.json)
//   public/commands.html, discord.html, slack.html
//                         <!-- commands:PLATFORM -->…<!-- /commands --> and <!-- trouble:PLATFORM -->…<!-- /trouble -->,
//                         cards and "Commands not working?" answers from public/commands.json (and, on /commands,
//                         <!-- intro:PLATFORM -->…<!-- /intro -->)
//   public/press/screen-*.png  copies of four screenshots from design/screens (git-ignored)
// Writes a file only when its content changes.
import { readFileSync, writeFileSync, copyFileSync, existsSync, mkdirSync } from 'node:fs';
import { inline } from './sync-docs.js';
import { loadRounds, packAvailability, servablePairs, PACKS } from '../functions/_rounds.js';

const WEB = new URL('../', import.meta.url);
export const PRESS_SHOTS = {
  'screen-home.png': 'home-hero-1280-light.png',
  'screen-question.png': 'rounds-reveal-right-375-light.png',
  'screen-result.png': 'rounds-end-1280-dark.png',
  'screen-discord.png': 'discord-hero-1280-light.png',
};

const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

// Replaces what sits between <!-- name --> and <!-- /base --> (base = name before a colon). Throws if a marker is missing.
export function inject(htmlText, name, content) {
  const re = new RegExp(`(<!-- ${name} -->)[\\s\\S]*?(<!-- /${name.split(':')[0]} -->)`);
  if (!re.test(htmlText)) throw new Error(`marker <!-- ${name} --> not found`);
  return htmlText.replace(re, (m, open, close) => `${open}${content}${close}`);
}

export const questionCount = (n) => `${(Math.floor(n / 1000) * 1000).toLocaleString('en-US')}+`;

// One chip per pack that at least one difficulty can fill, `all` first; data-difficulties lists where it plays.
export function packChips(availability) {
  const where = (pack) => Object.keys(availability).filter((d) => availability[d].includes(pack));
  return Object.keys(PACKS).filter((k) => where(k).length).map((k) => `
        <button type="button" class="chip" data-pack="${k}" data-difficulties="${where(k).join(' ')}" aria-pressed="${k === 'all'}">${esc(PACKS[k].label)}</button>`).join('') + '\n        ';
}

// The home page's question list: famous pairs only (both items >= 50,000 monthly views, fameBand 2 in sync-items.js), no
// drama (AI or Politics), at most 64 characters, each name once. One category at a time, the category of the most famous pair first,
// the most famous pair first within each: "Which is longer: the Nile or the Danube?"
export function promptLines(pairsDoc, n = 24) {
  const byCategory = new Map();
  const famous = pairsDoc.pairs.filter((p) => (p.fame ?? 0) >= 50000 && !/_drama$/.test(p.category)).sort((x, y) => y.fame - x.fame || x.id.localeCompare(y.id));
  for (const p of famous) byCategory.set(p.category, [...(byCategory.get(p.category) ?? []), p]);
  const used = new Set();
  const lines = [];
  for (let added = true; added && lines.length < n;) {
    added = false;
    for (const list of byCategory.values()) {
      const k = list.findIndex((p) => ![p.a, p.b].some((name) => used.has(name.toLowerCase())) && promptLine(p).length <= 64);
      if (lines.length >= n || k < 0) continue;
      const [p] = list.splice(k, 1);
      for (const name of [p.a, p.b]) used.add(name.toLowerCase());
      lines.push(promptLine(p));
      added = true;
    }
  }
  return lines;
}
const promptLine = (p) => `${p.prompt.replace(/\?\s*$/, '')}: ${p.a} or ${p.b}?`;

// The list twice, the copy hidden from screen readers, so the marquee (styles.css) can loop without a seam.
export const promptList = (lines) => [false, true].map((copy) => `
          <ul class="prompts-list"${copy ? ' aria-hidden="true"' : ''}>${lines.map((l) => `
            <li>${esc(l)}</li>`).join('')}
          </ul>`).join('') + '\n          ';

export function commandCards(platform) {
  return platform.commands.map((c) => `
      <article class="cmd" data-item>
        <h3><code>${esc(c.name)}</code></h3>
        <p>${inline(c.does)}</p>
        <dl>
          <div><dt>Options</dt><dd>${c.options.length ? `<ul>${c.options.map((o) => `<li><code>${esc(o.name)}</code> ${inline(o.does)}</li>`).join('')}</ul>` : 'None'}</dd></div>
          <div><dt>Who can run it</dt><dd>${esc(c.who)}</dd></div>
        </dl>
      </article>`).join('') + '\n    ';
}

export const troubleList = (platform) => platform.trouble.map((x) => `
        <details><summary><span>${inline(x.q)}</span></summary><p>${inline(x.a)}</p></details>`).join('') + '\n      ';

// Width and height from a PNG's IHDR chunk.
export const pngSize = (buf) => [buf.readUInt32BE(16), buf.readUInt32BE(20)];

function rewrite(file, edit) {
  const url = new URL(file, WEB);
  const before = readFileSync(url, 'utf8');
  const after = edit(before);
  if (after !== before) writeFileSync(url, after);
}

// pool, compact, rounds, pairs: items/pool.json (server copy), the compact pairs, daily/rounds.json and items/pairs.json,
// as sync-items has them.
export function syncPages({ pool, compact, rounds, pairs }) {
  const data = loadRounds(pool, compact, rounds);
  const count = servablePairs(data).size;
  rewrite('public/index.html', (h) => inject(inject(inject(h, 'questions', questionCount(count)), 'packs', packChips(packAvailability(data))),
    'prompts', promptList(promptLines(pairs))));

  const commands = JSON.parse(readFileSync(new URL('public/commands.json', WEB), 'utf8'));
  const pages = { 'public/commands.html': ['discord', 'slack', 'web'], 'public/discord.html': ['discord'], 'public/slack.html': ['slack'] };
  for (const [file, platforms] of Object.entries(pages)) {
    rewrite(file, (h) => platforms.reduce((out, p) => {
      const cards = inject(inject(out, `commands:${p}`, commandCards(commands[p])), `trouble:${p}`, troubleList(commands[p]));
      return file === 'public/commands.html' ? inject(cards, `intro:${p}`, inline(commands[p].intro)) : cards;
    }, h));
  }

  mkdirSync(new URL('public/press/', WEB), { recursive: true });
  for (const [dest, src] of Object.entries(PRESS_SHOTS)) {
    const from = new URL(`design/screens/${src}`, WEB);
    if (!existsSync(from)) { console.warn(`warning: design/screens/${src} not found; /press/${dest} is missing (node design/render.js screens)`); continue; }
    copyFileSync(from, new URL(`public/press/${dest}`, WEB));
    const [w, h] = pngSize(readFileSync(from)); // the page's width/height match the image, so it reserves the right space
    rewrite('public/press.html', (p) => p.replace(new RegExp(`(src="/press/${dest}") width="\\d+" height="\\d+"`), `$1 width="${w}" height="${h}"`));
  }
  return { count, files: ['public/index.html', ...Object.keys(pages), 'public/press.html'] };
}
