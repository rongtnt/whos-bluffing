// The test: picks 20 items, shows them one by one, asks the optional demographics, submits.
import { html, api, store, anonId } from './ui.js';
import { LEVELS } from './metrics.js';
import { showResults } from './results.js';

export const COUNTS = { '2afc': 12, interval: 6 };
const CONF = LEVELS.map((l) => Math.round(l * 100)); // 50..100, the six confidence buttons
const CHECK_SLOTS = [5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15]; // 1-based positions allowed for attention checks
const DEMO_FIELDS = ['age', 'edu', 'native', 'region'];

// Fisher–Yates on a copy.
export function shuffle(xs, rand = Math.random) {
  const a = [...xs];
  for (let i = a.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rand() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// n items spread evenly over domains (round-robin over shuffled domains), unseen ids first.
export function pickBalanced(items, n, seen, rand = Math.random) {
  const fresh = items.filter((i) => !seen.has(i.id));
  const pool = fresh.length >= n ? fresh : items; // ponytail: too few unseen left -> reuse the whole pool
  const groups = new Map();
  for (const it of shuffle(pool, rand)) {
    if (!groups.has(it.domain)) groups.set(it.domain, []);
    groups.get(it.domain).push(it);
  }
  const queues = shuffle([...groups.values()], rand);
  const target = Math.min(n, pool.length);
  const out = [];
  while (out.length < target) for (const q of queues) if (q.length && out.length < target) out.push(q.shift());
  return out;
}

// 12 two-alternative + 6 range items in random order; the 2 attention checks go to distinct positions 5–15.
// Attention checks are never excluded as "seen": every session needs both.
export function buildSession(items, seen = new Set(), rand = Math.random) {
  const main = shuffle([
    ...pickBalanced(items.filter((i) => i.type === '2afc'), COUNTS['2afc'], seen, rand),
    ...pickBalanced(items.filter((i) => i.type === 'interval'), COUNTS.interval, seen, rand),
  ], rand);
  const checks = shuffle(items.filter((i) => i.type === 'attention'), rand);
  const slots = shuffle(CHECK_SLOTS, rand).slice(0, checks.length);
  const out = [];
  let m = 0;
  let c = 0;
  for (let pos = 1; pos <= main.length + checks.length; pos += 1) out.push(slots.includes(pos) ? checks[c++] : main[m++]);
  return out;
}

const progress = (t, i, n) => html`<div class="progress"><progress value="${i}" max="${n}" aria-hidden="true"></progress><span>${t('test.progress', { i: i + 1, n })}</span></div>`;

function showChoice(ctx, item, i, n, done) {
  const { app, t } = ctx;
  const q = item.en;
  const t0 = performance.now();
  app.innerHTML = html`${progress(t, i, n)}
<h2 class="q" tabindex="-1">${q.prompt}</h2>
<div class="options">${q.options.map((o, k) => html`<button type="button" class="opt" data-k="${k}" aria-pressed="false">${o}</button>`)}</div>
<div id="conf" hidden>
  <p class="sub">${t('test.how_sure')}</p>
  <div class="conf" role="group" aria-label="${t('test.how_sure')}">${CONF.map((c) => html`<button type="button" data-c="${c}">${c}%</button>`)}</div>
  <p class="ends"><span>${t('test.coin_flip')}</span><span>${t('test.certain')}</span></p>
</div>`;
  app.querySelector('.q').focus();
  let choice = null;
  const opts = [...app.querySelectorAll('.opt')];
  for (const b of opts) {
    b.onclick = () => {
      choice = Number(b.dataset.k);
      for (const o of opts) o.setAttribute('aria-pressed', String(o === b));
      app.querySelector('#conf').hidden = false;
    };
  }
  for (const b of app.querySelectorAll('.conf button')) {
    b.onclick = () => {
      if (choice === null) return;
      done({ id: item.id, choice, conf: Number(b.dataset.c), rt_ms: Math.round(performance.now() - t0) });
    };
  }
}

// Range question (also used by the daily game, with its own button label). item: {id, accept, en: {prompt, unit}}.
export function showRange(ctx, item, i, n, done, button = ctx.t('test.next')) {
  const { app, t } = ctx;
  const q = item.en;
  const t0 = performance.now();
  app.innerHTML = html`${progress(t, i, n)}
<p class="sub">${t('test.range_intro')}</p>
<h2 class="q">${q.prompt}</h2>
<form class="range" novalidate>
  <label>${t('test.low')}<span class="field"><input name="low" type="number" inputmode="decimal" step="any" autocomplete="off"><span class="unit">${q.unit}</span></span></label>
  <label>${t('test.high')}<span class="field"><input name="high" type="number" inputmode="decimal" step="any" autocomplete="off"><span class="unit">${q.unit}</span></span></label>
  <p class="msg" role="alert"></p>
  <button class="primary block" type="submit">${button}</button>
</form>`;
  const form = app.querySelector('form');
  const say = (s) => { form.querySelector('.msg').textContent = s; };
  const value = (name) => (Number.isFinite(form[name].valueAsNumber) ? form[name].valueAsNumber : null);
  let warned = false; // warn once, then accept (out-of-bounds ranges are excluded at analysis time, not here)
  form.low.focus();
  form.onsubmit = (e) => {
    e.preventDefault();
    const lo = value('low');
    const hi = value('high');
    if (lo === null || hi === null) return say(t('test.need_numbers'));
    const [min, max] = item.accept;
    const problem = lo > hi ? t('test.swap') : lo < min || hi > max ? t('test.unusual', { unit: q.unit }) : null;
    if (problem && !warned) { warned = true; return say(problem); }
    return done({ id: item.id, low: Math.min(lo, hi), high: Math.max(lo, hi), rt_ms: Math.round(performance.now() - t0) });
  };
}

function showDemographics(ctx, onDone) {
  const { app, t } = ctx;
  const opts = ctx.strings.demo.options;
  app.innerHTML = html`<h2>${t('demo.title')}</h2>
<p class="muted">${t('demo.lead')}</p>
<form class="demo" novalidate>
  ${DEMO_FIELDS.map((f) => html`<label>${t(`demo.${f}`)}<select name="${f}"><option value="">${t('demo.choose')}</option>${Object.entries(opts[f]).map(([v, label]) => html`<option value="${v}">${label}</option>`)}</select></label>`)}
  <div class="hp" aria-hidden="true"><label>Leave empty <input name="hs_extra" tabindex="-1" autocomplete="off"></label></div>
  <div class="row"><button class="primary" type="submit">${t('demo.submit')}</button><button class="skip" type="button">${t('demo.skip')}</button></div>
</form>`;
  const form = app.querySelector('form');
  const honeypot = () => form.hs_extra.value;
  form.onsubmit = (e) => {
    e.preventDefault();
    const d = Object.fromEntries(DEMO_FIELDS.map((f) => [f, form[f].value]).filter(([, v]) => v));
    onDone(Object.keys(d).length ? d : null, honeypot());
  };
  form.querySelector('.skip').onclick = () => onDone(null, honeypot());
}

async function submit(ctx, run) {
  const { app, t } = ctx;
  app.innerHTML = html`<p class="muted" role="status">${t('submit.sending')}</p>`;
  const first = store.get('whosbluffing_first', null);
  const body = { lang: 'en', answers: run.answers, website: run.website || '', anon_id: anonId() };
  if (run.classCode) body.class_code = run.classCode;
  if (first) body.first_session_id = first;
  if (run.demographics) body.demographics = run.demographics;
  const r = await api('/api/submit', { method: 'POST', body });
  if (r.ok) {
    if (!first) store.set('whosbluffing_first', r.data.session_id);
    store.set('whosbluffing_seen', [...new Set([...store.get('whosbluffing_seen', []), ...run.session.map((i) => i.id)])]);
    showResults(ctx, r.data, run);
    return;
  }
  const message = r.status === 400 ? t('submit.rejected', { error: r.data?.error ?? r.status }) : t('submit.offline');
  app.innerHTML = html`<p class="msg" role="alert">${message}</p><button class="primary block" type="button">${t('submit.retry')}</button>`;
  app.querySelector('button').onclick = () => submit(ctx, run);
}

// opts: {classCode?, classLabel?}
export function startTest(ctx, opts) {
  ctx.chrome(false);
  window.scrollTo(0, 0);
  const session = buildSession(ctx.items, new Set(store.get('whosbluffing_seen', [])));
  const answers = [];
  const next = () => {
    window.scrollTo(0, 0);
    const i = answers.length;
    if (i === session.length) {
      showDemographics(ctx, (demographics, website) => submit(ctx, { ...opts, session, answers, demographics, website }));
      return;
    }
    const show = session[i].type === 'interval' ? showRange : showChoice;
    show(ctx, session[i], i, session.length, (a) => { answers.push(a); next(); });
  };
  next();
  if (opts.classCode) {
    ctx.app.insertAdjacentHTML('afterbegin', String(html`<p class="note">${ctx.t('landing.in_class', { name: opts.classLabel })}</p>`));
  }
}
