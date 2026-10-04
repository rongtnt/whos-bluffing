// Shared browser helpers: auto-escaping HTML templates, a JSON fetch wrapper, localStorage, inline-SVG charts.
// No top-level DOM access, so node tests can import the modules that use it.

class Raw {
  constructor(s) { this.s = s; }
  toString() { return this.s; }
}
export const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const fmt = (v) => (v instanceof Raw ? v.s : Array.isArray(v) ? v.map(fmt).join('') : v == null || v === false ? '' : esc(v));
// Tagged template: every interpolated value is escaped unless it is itself an html`` result.
export const html = (strings, ...vals) => new Raw(strings.reduce((out, s, i) => out + s + (i < vals.length ? fmt(vals[i]) : ''), ''));

// Never throws. status 0 = network failure.
export async function api(path, { method = 'GET', body } = {}) {
  try {
    const res = await fetch(path, {
      method,
      headers: body ? { 'content-type': 'application/json' } : {},
      body: body ? JSON.stringify(body) : undefined,
    });
    const data = res.status === 204 ? null : await res.json().catch(() => null);
    return { ok: res.ok && res.status !== 204, status: res.status, data };
  } catch {
    return { ok: false, status: 0, data: null };
  }
}

// localStorage can be missing or throw (private mode, blocked storage); the test still works without it.
export const store = {
  get(key, fallback) {
    try { return JSON.parse(localStorage.getItem(key)) ?? fallback; } catch { return fallback; }
  },
  set(key, value) {
    try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* storage unavailable: skip */ }
  },
};

const ANON_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_'; // 64 symbols: no modulo bias
let anon = null;

// This browser's anonymous id: 22 random characters kept in localStorage (a new one per page load if storage is
// blocked). Sent with daily answers and full assessments so a repeat visitor counts once (PRIVACY.md).
export function anonId() {
  if (anon) return anon;
  const saved = store.get('whosbluffing_anon', null);
  anon = typeof saved === 'string' && /^[A-Za-z0-9_-]{22}$/.test(saved)
    ? saved
    : Array.from(crypto.getRandomValues(new Uint8Array(22)), (b) => ANON_ALPHABET[b % 64]).join('');
  store.set('whosbluffing_anon', anon);
  return anon;
}

export const pct = (x) => Math.round(x * 100);
export const signed = (n) => (n > 0 ? `+${n}` : n < 0 ? `−${-n}` : '0');
export const num = (x) => x.toLocaleString('en-US', { maximumFractionDigits: 3 });

export const chartLabels = (t) => ({
  title: t('results.chart_title'), x: t('results.chart_x'), y: t('results.chart_y'), diag: t('results.chart_diag'),
});

const f1 = (v) => Math.round(v * 10) / 10;

// Calibration chart: confidence (50–100%) vs. share correct, dashed diagonal = perfect calibration.
// series: [{name, bins:[{conf, n, acc}], cls:'s0'|'s1'}]
export function calibrationChart(series, labels) {
  const W = 320, H = 250, L = 54, R = 14, T = 12, B = 44;
  const X = (c) => f1(L + ((c - 0.5) / 0.5) * (W - L - R));
  const Y = (a) => f1(T + (1 - a) * (H - T - B));
  const maxN = Math.max(1, ...series.flatMap((s) => s.bins.map((b) => b.n)));
  const r = (n) => f1(3 + 4 * Math.sqrt(n / maxN));
  const gridY = [0, 0.25, 0.5, 0.75, 1].map((a) => html`<line class="grid" x1="${L}" x2="${W - R}" y1="${Y(a)}" y2="${Y(a)}"/><text class="tick" x="${L - 6}" y="${Y(a) + 4}" text-anchor="end">${pct(a)}%</text>`);
  const ticksX = [0.5, 0.6, 0.7, 0.8, 0.9, 1].map((c) => html`<text class="tick" x="${X(c)}" y="${H - B + 16}" text-anchor="middle">${pct(c)}%</text>`);
  const lines = series.map((s) => {
    const pts = s.bins.filter((b) => b.n > 0);
    return html`<polyline class="series ${s.cls}" points="${pts.map((b) => `${X(b.conf)},${Y(b.acc)}`).join(' ')}"/>${pts.map((b) => html`<circle class="dot ${s.cls}" cx="${X(b.conf)}" cy="${Y(b.acc)}" r="${r(b.n)}"><title>${s.name} · ${pct(b.conf)}% → ${pct(b.acc)}% (n=${b.n})</title></circle>`)}`;
  });
  return html`<svg class="chart" viewBox="0 0 ${W} ${H}" role="img" aria-label="${labels.title}">
<title>${labels.title}</title>${gridY}${ticksX}
<line class="diag" x1="${X(0.5)}" y1="${Y(0.5)}" x2="${X(1)}" y2="${Y(1)}"/>${lines}
<text class="axis" x="${f1((L + W - R) / 2)}" y="${H - 6}" text-anchor="middle">${labels.x}</text>
<text class="axis" transform="rotate(-90)" x="${-f1(T + (H - T - B) / 2)}" y="13" text-anchor="middle">${labels.y}</text>
</svg><p class="legend"><span><i class="sw diag"></i>${labels.diag}</span>${series.map((s) => html`<span><i class="sw ${s.cls}"></i>${s.name}</span>`)}</p>`;
}

// Histogram of overconfidence buckets [{from, to, n}] in percentage points.
export function histChart(hist, labels) {
  const W = 320, H = 190, L = 30, R = 10, T = 10, B = 40;
  const lo = hist[0].from, hi = hist[hist.length - 1].to;
  const X = (v) => f1(L + ((v - lo) / (hi - lo)) * (W - L - R));
  const maxN = Math.max(1, ...hist.map((h) => h.n));
  const bar = (h) => {
    const bh = f1((h.n / maxN) * (H - T - B));
    return html`<rect class="bar" x="${X(h.from) + 1}" y="${f1(H - B - bh)}" width="${f1(X(h.to) - X(h.from) - 2)}" height="${bh}"><title>${h.from} to ${h.to}: ${h.n}</title></rect>`;
  };
  const ticks = [-50, 0, 50, 100].filter((v) => v >= lo && v <= hi);
  return html`<svg class="chart" viewBox="0 0 ${W} ${H}" role="img" aria-label="${labels.title}">
<title>${labels.title}</title>${hist.map(bar)}
<line class="zero" x1="${X(0)}" x2="${X(0)}" y1="${T}" y2="${H - B}"/>
${ticks.map((v) => html`<text class="tick" x="${X(v)}" y="${H - B + 16}" text-anchor="${v === hi ? 'end' : v === lo ? 'start' : 'middle'}">${v > 0 ? `+${v}` : v}</text>`)}
<text class="axis" x="${f1((L + W - R) / 2)}" y="${H - 6}" text-anchor="middle">${labels.x}</text>
</svg>`;
}
