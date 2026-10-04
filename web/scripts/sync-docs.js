// Renders the repo's Markdown docs into pages of the site (git-ignored, like the other synced copies; sync-items.js
// runs this, so `npm run sync-items` covers it):
//   PRIVACY.md -> public/privacy.html    TERMS.md -> public/terms.html    docs/api-daily.md -> public/docs/api.html
// Markdown subset: # headings, paragraphs, - and 1. lists, **bold**, [links](url), `code`. Page chrome: scripts/page.html.
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const ROOT = new URL('../../', import.meta.url);
const WEB = new URL('../', import.meta.url);
const REPO = 'https://github.com/rongtnt/whos-bluffing/blob/main/';

export const DOCS = [
  { src: 'PRIVACY.md', out: 'public/privacy.html', path: '/privacy', title: "Privacy | Who's Bluffing?",
    description: "What Who's Bluffing stores, what it never stores, and how the anonymous answers are used." },
  { src: 'TERMS.md', out: 'public/terms.html', path: '/terms', title: "Terms of use | Who's Bluffing?",
    description: "Who's Bluffing is free, non-commercial and provided as is. No accounts; acceptable use; data use as in the privacy policy." },
  { src: 'docs/api-daily.md', out: 'public/docs/api.html', path: '/docs/api', title: "Daily API | Who's Bluffing?",
    description: "The JSON API behind the Who's Bluffing daily game: today’s questions, answers, completion, stats, flags and the KPI." },
];

const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const slug = (s) => s.toLowerCase().replace(/<[^>]+>/g, '').replace(/&[a-z]+;/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
const SAFE_HREF = /^(https?:\/\/|\/|#)/; // no javascript: or data: links

// One line of inline markup. Code spans are cut out first, so nothing inside them is formatted; text is escaped
// before links and bold are applied.
export function inline(text) {
  return text.split(/(`[^`]+`)/).map((part, i) => (i % 2
    ? `<code>${esc(part.slice(1, -1))}</code>`
    : esc(part)
      .replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, (m, label, href) => (SAFE_HREF.test(href) ? `<a href="${href}">${label}</a>` : label))
      .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>'))).join('');
}

export function markdown(md) {
  const out = [];
  let para = [];
  let list = null; // {tag, items}
  const endPara = () => { if (para.length) out.push(`<p>${inline(para.join(' '))}</p>`); para = []; };
  const endList = () => { if (list) out.push(`<${list.tag}>\n${list.items.map((x) => `<li>${inline(x)}</li>`).join('\n')}\n</${list.tag}>`); list = null; };
  for (const raw of md.split('\n')) {
    const line = raw.trim();
    const heading = line.match(/^(#{1,4})\s+(.+)$/);
    const item = line.match(/^(?:[-*]|(\d+)\.)\s+(.+)$/);
    if (!line) { endPara(); endList(); } else if (heading) {
      endPara(); endList();
      const html = inline(heading[2]);
      out.push(`<h${heading[1].length} id="${slug(html)}">${html}</h${heading[1].length}>`);
    } else if (item) {
      endPara();
      const tag = item[1] ? 'ol' : 'ul';
      if (list?.tag !== tag) { endList(); list = { tag, items: [] }; }
      list.items.push(item[2]);
    } else if (list) list.items[list.items.length - 1] += ` ${line}`; // wrapped list item
    else para.push(line);
  }
  endPara();
  endList();
  return out.join('\n');
}

export function renderPage(doc, md, template) {
  const main = `<article class="wrap prose">\n${markdown(md)}\n<p class="muted small">Source: <a href="${REPO}${doc.src}">${doc.src}</a> on GitHub.</p>\n</article>`;
  const fill = { title: esc(doc.title), description: esc(doc.description), path: doc.path, main };
  return template.replace(/\{\{(title|description|path|main)\}\}/g, (m, key) => fill[key]);
}

export function syncDocs() {
  const template = readFileSync(new URL('scripts/page.html', WEB), 'utf8');
  for (const doc of DOCS) {
    const dest = new URL(doc.out, WEB);
    mkdirSync(new URL('.', dest), { recursive: true });
    writeFileSync(dest, renderPage(doc, readFileSync(new URL(doc.src, ROOT), 'utf8'), template));
  }
  return DOCS.map((d) => d.out);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) console.log(`synced docs: ${syncDocs().join(', ')}`);
