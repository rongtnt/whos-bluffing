// Share card: drawn on a canvas in the browser (nothing uploaded), square 1080×1080 or wide 1200×630.
import qrcode from './vendor/qrcode.js';
import { html } from './ui.js';
import { attachTilt } from './motion.js';

const SIZES = {
  square: { w: 1080, h: 1080, pad: 80, qr: 260, brand: 46, h1: 84, h2: 52, foot: 36 },
  wide: { w: 1200, h: 630, pad: 60, qr: 220, brand: 36, h1: 50, h2: 34, foot: 28 },
};
const FONT = 'ui-sans-serif, -apple-system, "Segoe UI", Roboto, Helvetica, Arial, sans-serif, "Apple Color Emoji", "Segoe UI Emoji", "Noto Color Emoji"';
const COLORS = { bg: '#FBFAF7', fg: '#111827', muted: '#5B6472', accent: '#2F5BFF' }; // light tokens (styles.css)

// The mark (brand/mark.svg, viewBox 28 x 60): a question mark in five rounded pieces; the elbow is turned -52° about
// (18.5, 29.5) and the dot, a square, 45° about (14, 52.9). [x, y, w, h, r, degrees, cx, cy] in mark units.
export const MARK_PIECES = [
  [0, 0, 28, 10, 3],
  [18, 12.2, 10, 12, 3],
  [10.5, 24.5, 16, 10, 3, -52, 18.5, 29.5],
  [9, 36.5, 10, 8, 3],
  [9.6, 48.5, 8.8, 8.8, 2.5, 45, 14, 52.9],
];
const MARK_BOTTOM = 59.1; // the dot's lowest point, in mark units

// Draws the mark `h` px tall with its top-left corner at x, y: pieces in `ink`, the dot in `dot`. Returns its width.
export function drawMark(g, x, y, h, ink = COLORS.fg, dot = COLORS.accent) {
  const k = h / 60;
  MARK_PIECES.forEach(([px, py, w, ph, r, deg, cx, cy], i) => {
    g.save();
    g.translate(x, y);
    g.scale(k, k);
    if (deg) {
      g.translate(cx, cy);
      g.rotate((deg * Math.PI) / 180);
      g.translate(-cx, -cy);
    }
    g.fillStyle = i === MARK_PIECES.length - 1 ? dot : ink;
    g.beginPath();
    if (g.roundRect) g.roundRect(px, py, w, ph, r); else g.rect(px, py, w, ph);
    g.fill();
    g.restore();
  });
  return 28 * k;
}

// The lockup in the card's top-left corner: the name, then the mark as its question mark, the dot on the baseline.
function drawBrand(g, x, y, size) {
  const name = "Who's Bluffing";
  g.font = `700 ${size}px ${FONT}`;
  g.fillStyle = COLORS.fg;
  g.fillText(name, x, y);
  const baseline = y + Math.round(size * 0.94); // textBaseline is 'top'
  const h = Math.round(size * 1.3);
  drawMark(g, x + g.measureText(name).width + Math.round(size * 0.18), baseline - (h * MARK_BOTTOM) / 60, h);
}

// Greedy word wrap. measure(str) returns the width of str.
export function wrap(text, maxWidth, measure) {
  const lines = [];
  let line = '';
  for (const word of text.split(/\s+/).filter(Boolean)) {
    const next = line ? `${line} ${word}` : word;
    if (line && measure(next) > maxWidth) {
      lines.push(line);
      line = word;
    } else {
      line = next;
    }
  }
  if (line) lines.push(line);
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
  drawBrand(g, z.pad, z.pad, z.brand);
  drawQr(g, url, z.w - z.pad - z.qr, z.h - z.pad - z.qr, z.qr);

  // Footer, bottom-aligned left of the QR: call to action, then the site address on the last line.
  const footW = z.w - 3 * z.pad - z.qr;
  const urlY = z.h - z.pad - z.foot;
  const cta = layout(g, `${t('share.card_question')} ${lines.cta ?? t('share.card_cta')}`, footW, z.foot, 600);
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

// lines: {ranges, conf, cta?, copy?}. cta replaces the card's call to action; copy adds a one-tap "Copy result" button.
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
  ${lines.copy ? html`<button type="button" class="primary" data-a="text">${t('share.copy_result')}</button>` : ''}
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
      a.download = `whosbluffing-${kind}.png`;
      document.body.append(a);
      a.click();
      a.remove();
    },
    image: () => navigator.clipboard.write([new ClipboardItem({ 'image/png': toBlob(canvas) })]).then(() => say(t('share.copied'))),
    link: () => navigator.clipboard.writeText(url).then(() => say(t('share.copied'))),
    text: () => navigator.clipboard.writeText(lines.copy).then(() => say(t('share.copied'))),
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

// --- rounds: the card is built around the type and the score; the QR opens the challenge link ----------------------
const ROUND_SIZES = {
  square: { w: 1080, h: 1080, pad: 80, qr: 240, brand: 46, kicker: 40, type: 132, score: 88, line: 46, foot: 34 },
  wide: { w: 1200, h: 630, pad: 60, qr: 210, brand: 34, kicker: 28, type: 92, score: 60, line: 32, foot: 26 },
};

// lines: {type, score, line, cta}; url: the challenge link (QR), shown as the bare host.
export function drawRoundCard(kind, { lines, url }) {
  const z = ROUND_SIZES[kind];
  const canvas = document.createElement('canvas');
  canvas.width = z.w;
  canvas.height = z.h;
  const g = canvas.getContext('2d');
  g.fillStyle = COLORS.bg;
  g.fillRect(0, 0, z.w, z.h);
  g.textBaseline = 'top';
  drawBrand(g, z.pad, z.pad, z.brand);
  drawQr(g, url, z.w - z.pad - z.qr, z.h - z.pad - z.qr, z.qr);
  const textW = z.w - 2 * z.pad - (kind === 'wide' ? z.qr + z.pad : 0);
  let y = z.pad + z.brand * 2;
  y = drawLines(g, layout(g, lines.kicker, textW, z.kicker, 600), z.pad, y, z.kicker, 600, COLORS.muted) + z.kicker * 0.2;
  y = drawLines(g, layout(g, lines.type, textW, z.type, 800), z.pad, y, z.type, 800, COLORS.fg);
  y = drawLines(g, layout(g, lines.score, textW, z.score, 800), z.pad, y + z.score * 0.1, z.score, 800, COLORS.accent);
  drawLines(g, layout(g, lines.line, textW, z.line, 400), z.pad, y + z.line * 0.3, z.line, 400, COLORS.fg);
  const footW = z.w - 3 * z.pad - z.qr;
  const hostY = z.h - z.pad - z.foot;
  const cta = layout(g, lines.cta, footW, z.foot, 600);
  drawLines(g, cta, z.pad, hostY - cta.length * lineHeight(z.foot) - z.foot * 0.3, z.foot, 600, COLORS.muted);
  drawLines(g, [new URL(url).host], z.pad, hostY, z.foot, 700, COLORS.accent);
  return canvas;
}

// The share panel of a finished round: card preview (square/wide), copy text, native share, download, copy image.
// onShare(action) is called once per share action (the /api/event counter).
export function renderRoundShare(ctx, el, { lines, copy, url, onShare }) {
  const { t } = ctx;
  let kind = 'square';
  let canvas = null;
  const native = typeof navigator.share === 'function';
  el.innerHTML = html`<div class="seg" role="group" aria-label="${t('share.title')}"><button type="button" data-k="square" aria-pressed="true">${t('share.square')}</button><button type="button" data-k="wide" aria-pressed="false">${t('share.wide')}</button></div>
<div class="card-tilt"><img class="card-img" alt="${lines.type} · ${lines.score} · ${lines.line}"></div>
<p class="muted small">${t('share.long_press')}</p>
<div class="row">
  <button type="button" class="primary" data-a="text">${t('share.copy_result')}</button>
  ${native ? html`<button type="button" data-a="native">${t('rounds.share_native')}</button>` : ''}
  <button type="button" data-a="download">${t('share.download')}</button>
  ${canCopyImage() ? html`<button type="button" data-a="image">${t('share.copy_image')}</button>` : ''}
</div>
<p class="msg ok" role="status"></p>`;
  const img = el.querySelector('img');
  attachTilt(el.querySelector('.card-tilt')); // the preview leans towards the pointer
  const say = (s) => { el.querySelector('.msg').textContent = s; };
  const draw = () => {
    canvas = drawRoundCard(kind, { lines, url });
    img.src = canvas.toDataURL('image/png');
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
    text: () => navigator.clipboard.writeText(copy).then(() => say(t('share.copied'))),
    native: () => navigator.share({ text: copy }),
    download() {
      const a = document.createElement('a');
      a.href = img.src;
      a.download = `whosbluffing-${kind}.png`;
      document.body.append(a);
      a.click();
      a.remove();
    },
    image: () => navigator.clipboard.write([new ClipboardItem({ 'image/png': toBlob(canvas) })]).then(() => say(t('share.copied'))),
  };
  for (const b of el.querySelectorAll('[data-a]')) {
    b.onclick = () => {
      const failed = () => say(t('share.copy_failed'));
      say('');
      try {
        Promise.resolve(actions[b.dataset.a]()).then(() => onShare?.(b.dataset.a), (e) => { if (e?.name !== 'AbortError') failed(); });
      } catch { failed(); }
    };
  }
  draw();
}
