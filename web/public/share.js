// Share card: drawn on a canvas in the browser (nothing uploaded), square 1080×1080 or wide 1200×630.
import qrcode from './vendor/qrcode.js';
import { html } from './ui.js';

const SIZES = {
  square: { w: 1080, h: 1080, pad: 80, qr: 260, brand: 46, h1: 84, h2: 52, foot: 36 },
  wide: { w: 1200, h: 630, pad: 60, qr: 220, brand: 36, h1: 50, h2: 34, foot: 28 },
};
const FONT = 'system-ui, -apple-system, "PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", "Noto Sans CJK SC", "Segoe UI", Roboto, sans-serif';
const COLORS = { bg: '#fbfaf7', fg: '#1d1d1f', muted: '#5f6368', accent: '#1f5eff' };
const CJK = '⺀-鿿豈-﫿＀-￯';
const TOKEN = new RegExp(`[${CJK}]|[^\\s${CJK}]+|\\s+`, 'g');
const NO_LINE_START = /^[，。、！？；：）」』%,.!?;:)]/;

// Greedy wrap that works for both languages: CJK breaks between characters, other text between words,
// and closing punctuation never starts a line. measure(str) returns the width of str.
export function wrap(text, maxWidth, measure) {
  const lines = [];
  let line = '';
  for (const tok of text.match(TOKEN) ?? []) {
    const breakable = line.trim() && !/^\s+$/.test(tok) && !NO_LINE_START.test(tok);
    if (breakable && measure((line + tok).trimEnd()) > maxWidth) {
      lines.push(line.trimEnd());
      line = tok;
    } else {
      line += tok;
    }
  }
  if (line.trim()) lines.push(line.trimEnd());
  return lines;
}

const lineHeight = (size) => Math.round(size * 1.28);

function layout(g, text, maxWidth, size, weight) {
  g.font = `${weight} ${size}px ${FONT}`;
  return wrap(text, maxWidth, (s) => g.measureText(s).width);
}

// Draws pre-wrapped lines from y downwards; returns the y below the last line.
function drawLines(g, lines, x, y, size, weight, color) {
  g.font = `${weight} ${size}px ${FONT}`;
  g.fillStyle = color;
  lines.forEach((l, i) => g.fillText(l, x, y + i * lineHeight(size)));
  return y + lines.length * lineHeight(size);
}

function drawQr(g, text, x, y, size) {
  const q = qrcode(0, 'M');
  q.addData(text);
  q.make();
  const n = q.getModuleCount();
  const cell = Math.floor(size / (n + 8)); // 4-module quiet zone on each side
  const off = Math.floor((size - cell * n) / 2);
  g.fillStyle = '#ffffff';
  g.fillRect(x, y, size, size);
  g.fillStyle = '#000000';
  for (let r = 0; r < n; r += 1) for (let c = 0; c < n; c += 1) if (q.isDark(r, c)) g.fillRect(x + off + c * cell, y + off + r * cell, cell, cell);
}

export function drawCard(kind, { t, lines, url }) {
  const z = SIZES[kind];
  const canvas = document.createElement('canvas');
  canvas.width = z.w;
  canvas.height = z.h;
  const g = canvas.getContext('2d');
  g.fillStyle = COLORS.bg;
  g.fillRect(0, 0, z.w, z.h);
  g.textBaseline = 'top';
  drawLines(g, ['HowSure'], z.pad, z.pad, z.brand, 700, COLORS.accent);
  drawQr(g, url, z.w - z.pad - z.qr, z.h - z.pad - z.qr, z.qr);

  // Footer, bottom-aligned left of the QR: call to action, then the site address on the last line.
  const footW = z.w - 3 * z.pad - z.qr;
  const urlY = z.h - z.pad - z.foot;
  const cta = layout(g, `${t('share.card_question')} ${t('share.card_cta')}`, footW, z.foot, 600);
  const ctaY = urlY - cta.length * lineHeight(z.foot) - z.foot * 0.3;
  drawLines(g, cta, z.pad, ctaY, z.foot, 600, COLORS.muted);
  drawLines(g, [url.replace(/^https?:\/\//, '').replace(/\/$/, '')], z.pad, urlY, z.foot, 700, COLORS.accent);

  // Headlines, centred in the free space between the brand and the QR (square) or the footer (wide).
  const textW = kind === 'square' ? z.w - 2 * z.pad : footW;
  const h1 = layout(g, lines.ranges, textW, z.h1, 700);
  const h2 = layout(g, lines.conf, textW, z.h2, 400);
  const gap = z.h2 * 0.6;
  const blockH = h1.length * lineHeight(z.h1) + gap + h2.length * lineHeight(z.h2);
  const top = z.pad + z.brand * 2;
  const bottom = kind === 'square' ? z.h - z.pad - z.qr : ctaY;
  const y = top + Math.max(0, (bottom - top - blockH) / 2);
  drawLines(g, h2, z.pad, drawLines(g, h1, z.pad, y, z.h1, 700, COLORS.fg) + gap, z.h2, 400, COLORS.fg);
  return canvas;
}

const canCopyImage = () => Boolean(navigator.clipboard?.write) && typeof ClipboardItem !== 'undefined';
const toBlob = (canvas) => new Promise((resolve, reject) => canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('toBlob'))), 'image/png'));

export function renderShare(ctx, el, lines) {
  const { t } = ctx;
  const url = `${location.origin}/`;
  let kind = 'square';
  let canvas = null;
  el.innerHTML = html`<h2>${t('share.title')}</h2>
<div class="seg" role="group"><button type="button" data-k="square" aria-pressed="true">${t('share.square')}</button><button type="button" data-k="wide" aria-pressed="false">${t('share.wide')}</button></div>
<img class="card-img" alt="${lines.ranges} ${lines.conf}">
<p class="muted small">${t('share.long_press')}</p>
<div class="row">
  <button type="button" data-a="download">${t('share.download')}</button>
  ${canCopyImage() ? html`<button type="button" data-a="image">${t('share.copy_image')}</button>` : ''}
  <button type="button" data-a="link">${t('share.copy_link')}</button>
</div>
<p class="url small">${url}</p>
<p class="msg ok" role="status"></p>`;
  const img = el.querySelector('img');
  const say = (s) => { el.querySelector('.msg').textContent = s; };
  const draw = () => {
    canvas = drawCard(kind, { t, lines, url });
    img.src = canvas.toDataURL('image/png'); // data URL so long-press "save image" works in in-app browsers
  };
  for (const b of el.querySelectorAll('.seg button')) {
    b.onclick = () => {
      kind = b.dataset.k;
      for (const o of el.querySelectorAll('.seg button')) o.setAttribute('aria-pressed', String(o === b));
      draw();
    };
  }
  // Every action starts synchronously inside the click: Safari drops clipboard access after an await.
  const actions = {
    download() {
      const a = document.createElement('a');
      a.href = img.src;
      a.download = `howsure-${kind}.png`;
      document.body.append(a);
      a.click();
      a.remove();
    },
    image: () => navigator.clipboard.write([new ClipboardItem({ 'image/png': toBlob(canvas) })]).then(() => say(t('share.copied'))),
    link: () => navigator.clipboard.writeText(url).then(() => say(t('share.copied'))),
  };
  for (const b of el.querySelectorAll('[data-a]')) {
    b.onclick = () => {
      const failed = () => say(t('share.copy_failed'));
      say('');
      try { Promise.resolve(actions[b.dataset.a]()).catch(failed); } catch { failed(); }
    };
  }
  draw();
}
