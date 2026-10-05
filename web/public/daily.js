// The daily game at /: five range questions (the same for everyone each UTC day), feedback after each answer,
// then the result with today's histogram, streak, 30-day hit rate and a share card. Scoring is server-side
// (docs/api-daily.md). Local state: whosbluffing_anon (ui.js) and whosbluffing_daily = {date: play}, so a reload resumes the game.
// The page's hero holds the "Play today's game" button; ctx.setPlay(label, action) tells it what to do.
import { html, api, store, anonId, fmtMonth, fmtValue as sharedValue } from './ui.js';
import { showRange } from './test.js';
import { renderShare } from './share.js';

const PLAYS_KEY = 'whosbluffing_daily';
const KEEP_DAYS = 400; // local plays older than this are dropped
const DAY_MS = 86400000;
const shiftDay = (date, n) => new Date(Date.parse(`${date}T00:00:00Z`) + n * DAY_MS).toISOString().slice(0, 10);

// Years print without separators or unit (1969, not 1,969 year); everything else en-US style, with its unit.
export const fmtNumber = (v, unit) => (unit === 'year' ? String(v) : unit === 'month' ? fmtMonth(v) : v.toLocaleString('en-US', { maximumFractionDigits: 3 }));
export const fmtValue = (v, unit) => (unit === 'year' ? String(v) : sharedValue(v, unit)); // months, dollars, big counts: ui.js

// i18n key of the one-line calibration note under an answer.
export const noteKey = (a) => (a.hit ? 'daily.note_hit' : a.truth > a.high ? 'daily.note_above' : 'daily.note_below');

// Hit rate over the completed local plays of the last 30 days (today included).
export function personalStats(plays, today) {
  const from = shiftDay(today, -29);
  const recent = Object.entries(plays).filter(([d, p]) => d >= from && d <= today && p.result).map(([, p]) => p.result);
  const hits = recent.reduce((s, r) => s + r.hits, 0);
  const n = recent.reduce((s, r) => s + r.n, 0);
  return { plays: recent.length, hits, n, rate: n ? hits / n : null };
}

// Bars for hits 0..5; the player's own bar is highlighted.
export function hitsChart(hist, mine, title) {
  const W = 320, H = 150, L = 6, R = 6, T = 18, B = 24;
  const bw = (W - L - R) / hist.length;
  const max = Math.max(1, ...hist);
  const bars = hist.map((c, k) => {
    const h = Math.round(((H - T - B) * c) / max * 10) / 10;
    const x = Math.round((L + k * bw + 5) * 10) / 10;
    const cx = Math.round((L + (k + 0.5) * bw) * 10) / 10;
    return html`<rect class="bar${k === mine ? ' mine' : ''}" x="${x}" y="${H - B - h}" width="${Math.round((bw - 10) * 10) / 10}" height="${h}"><title>${k} caught: ${c}</title></rect>
<text class="tick" x="${cx}" y="${H - B - h - 4}" text-anchor="middle">${c || ''}</text><text class="axis" x="${cx}" y="${H - 6}" text-anchor="middle">${k}</text>`;
  });
  return html`<svg class="chart" viewBox="0 0 ${W} ${H}" role="img" aria-label="${title}"><title>${title}</title>${bars}</svg>`;
}

const loadPlays = () => store.get(PLAYS_KEY, {});
function savePlay(date, play) {
  const cutoff = shiftDay(date, -KEEP_DAYS);
  const plays = Object.fromEntries(Object.entries(loadPlays()).filter(([d]) => d >= cutoff));
  store.set(PLAYS_KEY, { ...plays, [date]: play });
}

function retryScreen(ctx, message, again) {
  ctx.app.innerHTML = html`<p class="msg" role="alert">${message}</p><button class="primary block" type="button">${ctx.t('daily.retry')}</button>`;
  ctx.app.querySelector('button').onclick = again;
}

function flagForm(ctx, el, itemId) {
  const { t } = ctx;
  el.innerHTML = html`<details class="flag"><summary>${t('daily.flag')}</summary>
<form class="row" novalidate><input name="reason" maxlength="280" autocomplete="off" placeholder="${t('daily.flag_reason')}" aria-label="${t('daily.flag_reason')}"><button type="submit">${t('daily.flag_send')}</button></form>
<p class="msg ok" role="status"></p></details>`;
  const form = el.querySelector('form');
  form.onsubmit = async (e) => {
    e.preventDefault();
    const r = await api('/api/flag', { method: 'POST', body: { item_id: itemId, anon_id: anonId(), reason: form.reason.value.trim() } });
    el.querySelector('.msg').textContent = r.ok ? t('daily.flag_thanks') : t('daily.flag_failed');
    if (r.ok) form.hidden = true;
  };
}

function showFeedback(ctx, day, play, k, next) {
  const { app, t } = ctx;
  const item = day.items[k];
  const a = play.answers[item.id];
  app.innerHTML = html`<div class="progress"><progress value="${k + 1}" max="${day.items.length}" aria-hidden="true"></progress><span>${t('test.progress', { i: k + 1, n: day.items.length })}</span></div>
<h2 class="q">${item.prompt}</h2>
<section class="feedback ${a.hit ? 'is-hit' : 'is-miss'}" aria-live="polite">
  <p class="verdict">${a.hit ? `✓ ${t('daily.inside')}` : `✗ ${t('daily.outside')}`}</p>
  <p>${t('daily.truth')} <b>${fmtValue(a.truth, item.unit)}</b> · <a href="${a.source}" target="_blank" rel="noopener noreferrer">${t('daily.source')}</a></p>
  <p>${t('daily.your_range', { low: fmtNumber(a.low, item.unit), high: fmtValue(a.high, item.unit) })}</p>
  <p class="muted">${t(noteKey(a))}</p>
</section>
<button id="next" class="primary block" type="button">${k + 1 < day.items.length ? t('daily.next') : t('daily.see_result')}</button>
<div id="flag"></div>`;
  app.querySelector('#next').onclick = next;
  app.querySelector('#next').focus();
  flagForm(ctx, app.querySelector('#flag'), item.id);
}

async function sendAnswer(ctx, day, play, k, input) {
  ctx.app.innerHTML = html`<p class="muted" role="status">${ctx.t('daily.sending')}</p>`;
  const item = day.items[k];
  const r = await api('/api/daily/answer', {
    method: 'POST',
    body: { date: day.date, item_id: item.id, low: input.low, high: input.high, anon_id: anonId(), surface: 'web', rt_ms: input.rt_ms },
  });
  if (!r.ok) return retryScreen(ctx, r.status === 400 ? r.data?.error ?? ctx.t('daily.offline') : ctx.t('daily.offline'), () => sendAnswer(ctx, day, play, k, input));
  // The server keeps the first answer; show what it scored (a resend after a lost reply returns that one).
  const answers = { ...play.answers, [item.id]: { low: input.low, high: input.high, hit: r.data.hit, truth: r.data.truth, source: r.data.source } };
  const updated = { ...play, answers };
  savePlay(day.date, updated);
  return showFeedback(ctx, day, updated, k, () => step(ctx, day, updated));
}

async function finish(ctx, day, play) {
  ctx.app.innerHTML = html`<p class="muted" role="status">${ctx.t('daily.sending')}</p>`;
  const r = await api('/api/daily/complete', { method: 'POST', body: { date: day.date, anon_id: anonId(), surface: 'web' } });
  if (!r.ok) return retryScreen(ctx, ctx.t('daily.offline'), () => finish(ctx, day, play));
  const { hits, n, streak, share_text } = r.data;
  const done = { ...play, result: { hits, n, streak, share_text } };
  savePlay(day.date, done);
  return showResult(ctx, day, done, r.data.today, true);
}

// Next unanswered question, or the end of the game.
function step(ctx, day, play) {
  const k = day.items.findIndex((it) => !play.answers[it.id]);
  if (k === -1) return finish(ctx, day, play);
  ctx.chrome(false);
  window.scrollTo(0, 0);
  const item = day.items[k];
  return showRange(ctx, { id: item.id, accept: item.accept, en: { prompt: item.prompt, unit: item.unit } }, k, day.items.length,
    (input) => sendAnswer(ctx, day, play, k, input), ctx.t('daily.lock_in'));
}

// The result below the hero. scroll: bring it into view (right after the last answer; not on a later visit).
async function showResult(ctx, day, play, todayStats, scroll = false) {
  const { app, t } = ctx;
  const { hits, n, streak, share_text } = play.result;
  let stats = todayStats;
  if (!stats) {
    const r = await api(`/api/daily/stats?date=${day.date}`);
    stats = r.ok ? r.data : null;
  }
  const grid = share_text.split('\n')[0].match(/[🟩🟥]+/u)?.[0] ?? '';
  const avg = stats?.avg_hits == null ? '–' : stats.avg_hits.toFixed(1);
  const me = personalStats(loadPlays(), day.date);
  ctx.chrome(true);
  ctx.setPlay(t('daily.see_result'), () => app.scrollIntoView());
  app.innerHTML = html`<h2 class="result-title">${t('daily.title', { number: day.number })}</h2>
<p class="grid" aria-hidden="true">${grid}</p>
<p class="headline">${t('daily.result_hits', { hits, n })}</p>
<p class="muted">${t('daily.result_explain')}</p>
<div class="counters">
  <div><b>${streak}</b><span>${t('daily.streak')}</span></div>
  <div><b>${me.rate == null ? '–' : `${Math.round(me.rate * 100)}%`}</b><span>${t('daily.rate_30')}</span></div>
  <div><b>${me.plays}</b><span>${t('daily.plays_30')}</span></div>
</div>
${stats ? html`<section class="card"><h2>${t('daily.today_title')}</h2>
<p>${t('daily.today_avg', { avg, n, players: stats.players.toLocaleString('en-US') })}</p>
<figure>${hitsChart(stats.hist.slice(0, n + 1), hits, t('daily.hist_title'))}<figcaption>${t('daily.hist_note')}</figcaption></figure></section>` : ''}
<section class="card" id="share"></section>
<p class="muted">${t('daily.come_back')}</p>
<p><a href="/test">${t('daily.full_link')}</a></p>`;
  renderShare(ctx, app.querySelector('#share'), {
    ranges: `#${day.number} ${grid}`,
    conf: t('daily.card_line', { hits, n, avg }),
    cta: t('daily.card_cta'),
    copy: share_text,
  });
  if (scroll) app.scrollIntoView();
}

// The intro (title, rules, consent, Play button) is static in index.html; this wires the button to today's state.
export async function renderDaily(ctx) {
  const { app, t } = ctx;
  const showMessage = () => app.scrollIntoView();
  const r = await api('/api/daily');
  if (r.status === 404) {
    app.innerHTML = html`<p>${t('daily.no_game')}</p><p><a class="button primary block" href="/test">${t('nav.test')}</a></p>`;
    ctx.setPlay(null, showMessage);
    return;
  }
  if (!r.ok) {
    ctx.setPlay(null, showMessage);
    return retryScreen(ctx, t('daily.failed'), () => renderDaily(ctx));
  }
  const day = r.data;
  const play = loadPlays()[day.date] ?? { number: day.number, answers: {} };
  if (play.result) return showResult(ctx, day, play, null);
  const done = day.items.filter((it) => play.answers[it.id]).length;
  app.replaceChildren(); // clears a retry message; an empty #app takes no space
  ctx.setPlay(done ? t('daily.resume', { done, n: day.items.length }) : t('daily.start'), () => step(ctx, day, play));
}
