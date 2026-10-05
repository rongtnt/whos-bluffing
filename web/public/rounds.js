// Rounds at / and on challenge pages (/c/<round>/<token>): ten comparison pairs per round. Pick A or B, say how sure
// you are, see both values and sources at once, with a line from the game (reactions.js), a sound (sound.js) and a
// little motion (motion.js); at the end your score, the result grid, type, calibration chart and challenge link.
// Scoring is server-side (docs/api-rounds.md). Local state: whosbluffing_anon (ui.js), whosbluffing_seen_pairs (the newest 300 pair ids
// played; the server keeps the last 300 it is sent), whosbluffing_round (the round in progress, so a reload resumes), whosbluffing_ranked
// ({date: score} of finished ranked rounds), whosbluffing_nick (the nickname for challenge links: null = never asked, '' =
// skipped), whosbluffing_mine (this browser's challenge tokens), whosbluffing_dares ({round_id: score} of finished dares);
// pack and difficulty in picker.js, the side after AI and Politics rounds (whosbluffing_lab, whosbluffing_party) in
// round-end.js, sound in site.js.
import { html, api, store, anonId, calibrationChart, chartLabels, signed } from './ui.js';
import { bins } from './metrics.js';
import { renderRoundShare } from './share.js';
import { initPicker, quickLabel, shareWith } from './picker.js';
import { pickReaction, bestLine } from './reactions.js';
import { createSound } from './sound.js';
import { countTo, raceTo, confetti } from './motion.js';
import { resultGrid, wireGrid, fmtValue, fmtPoints, boardOf, sideBlock, wireSide, savedSide, withSideLine, dareRankLabel, dareDone } from './round-end.js';
import { typeName } from './types.js';

export { fmtValue, fmtPoints };

const SEEN_KEY = 'whosbluffing_seen_pairs';
const ROUND_KEY = 'whosbluffing_round';
const RANKED_KEY = 'whosbluffing_ranked';
const NICK_KEY = 'whosbluffing_nick';
const MINE_KEY = 'whosbluffing_mine';
const DARES_KEY = 'whosbluffing_dares';
const MAX_SEEN = 300;
const KEEP_RANKED = 60; // days of finished ranked rounds kept locally
const KEEP_MINE = 50;
const CONFS = [50, 60, 70, 80, 90, 100];
const CONF_KEYS = { 5: 50, 6: 60, 7: 70, 8: 80, 9: 90, 0: 100 }; // keyboard: the tens digit, 0 = 100%
const CONFIDENT_MISS = 70; // a wrong answer at this confidence or more flashes red
const MIN_BINS = 9; // leaderboard bars shown at least
const TYPES = { Bluffer: 'bluffer', 'Hot-headed': 'hot_headed', Calibrated: 'calibrated', Modest: 'modest', Hedger: 'hedger' };
const SPEAKER = html`<svg class="i i-snd-on" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M4 9.5h3.5L12 5.5v13l-4.5-4H4z"/><path d="M15.5 9a4 4 0 0 1 0 6M18 6.5a7.5 7.5 0 0 1 0 11"/></svg><svg class="i i-snd-off" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M4 9.5h3.5L12 5.5v13l-4.5-4H4z"/><path d="m16 9.5 5 5M21 9.5l-5 5"/></svg>`;

const todayUTC = () => new Date().toISOString().slice(0, 10);
const fmtTotal = (n) => (n < 0 ? `−${-n}` : String(n));
export const typeKey = (type) => `rounds.type_${TYPES[type] ?? 'calibrated'}`;
const site = () => globalThis.window?.whosbluffing; // site.js: class mode and the sound setting
const sound = createSound({ isOn: () => site()?.soundOn() ?? true });
let picker = null;

// The newest MAX_SEEN ids, oldest first (the order the server trims from).
export function addSeen(seen, ids) {
  const fresh = seen.filter((id) => !ids.includes(id));
  return [...fresh, ...ids].slice(-MAX_SEEN);
}

// Bars for 100-point bins (from /api/round/stats), trimmed to where anyone scored; `mine` = your score or null.
// The bars grow up from the baseline (anim-grow).
export function scoreChart(stats, mine, title) {
  const counts = stats.score_hist;
  const binOf = (s) => Math.min(counts.length - 1, Math.floor((s - stats.bin_from) / stats.bin_width));
  const used = counts.map((c, k) => (c > 0 || (mine != null && k === binOf(mine)) ? k : null)).filter((k) => k !== null);
  if (!used.length) return '';
  let lo = Math.max(0, used[0] - 1);
  let hi = Math.min(counts.length - 1, used.at(-1) + 1);
  while (hi - lo + 1 < MIN_BINS && (lo > 0 || hi < counts.length - 1)) { // a few players should not draw one huge bar
    if (lo > 0) lo -= 1;
    if (hi - lo + 1 < MIN_BINS && hi < counts.length - 1) hi += 1;
  }
  const shown = counts.slice(lo, hi + 1);
  const W = 320, H = 160, L = 6, R = 6, T = 18, B = 26;
  const bw = (W - L - R) / shown.length;
  const max = Math.max(1, ...shown);
  const r1 = (x) => Math.round(x * 10) / 10;
  const every = Math.ceil(shown.length / 6); // at most ~6 axis labels
  const bars = shown.map((c, j) => {
    const k = lo + j;
    const h = r1(((H - T - B) * c) / max);
    const from = stats.bin_from + k * stats.bin_width;
    const isMine = mine != null && k === binOf(mine);
    return html`<rect class="bar anim anim-grow${isMine ? ' mine' : ''}" x="${r1(L + j * bw + 1)}" y="${r1(H - B - h)}" width="${r1(Math.max(1, bw - 2))}" height="${h}"><title>${from} to ${from + stats.bin_width - 1}: ${c}</title></rect>
${j % every === 0 ? html`<text class="axis" x="${r1(L + j * bw + bw / 2)}" y="${H - 8}" text-anchor="middle">${from}</text>` : ''}`;
  });
  return html`<svg class="chart" viewBox="0 0 ${W} ${H}" role="img" aria-label="${title}"><title>${title}</title>${bars}</svg>`;
}

// "Today's ranked round", "Challenge", or "Quick round · Geography · Brutal".
export function roundLabel(t, st) {
  if (st.mode === 'ranked') return t('rounds.ranked');
  if (st.challenge) return t('rounds.challenge_round');
  return `${t('rounds.quick')} · ${quickLabel(st.pack, st.difficulty)}`;
}

const loadRound = () => store.get(ROUND_KEY, null);
const saveRound = (st) => store.set(ROUND_KEY, st);
const clearRound = () => store.set(ROUND_KEY, null);

function rememberRanked(date, score) {
  const cutoff = new Date(Date.now() - KEEP_RANKED * 86400000).toISOString().slice(0, 10);
  const kept = Object.fromEntries(Object.entries(store.get(RANKED_KEY, {})).filter(([d]) => d >= cutoff));
  store.set(RANKED_KEY, { ...kept, [date]: score });
}

function retryScreen(ctx, message, again) {
  keys = null;
  ctx.app.innerHTML = html`<p class="msg" role="alert">${message}</p><button class="primary block" type="button">${ctx.t('rounds.retry')}</button>`;
  ctx.app.querySelector('button').onclick = again;
}

// --- keyboard: A/B pick, 5-9 and 0 say how sure, N or Enter goes on (commands.json, "Web shortcuts") ---------------

let keys = null; // the current screen's handler, or null
let keysBound = false;
function bindKeys() {
  if (keysBound) return;
  keysBound = true;
  document.addEventListener('keydown', (e) => {
    if (!keys || e.altKey || e.ctrlKey || e.metaKey || e.target.closest?.('input, textarea, select, [contenteditable]')) return;
    keys(e.key.toLowerCase(), e);
  });
}

// --- one item ---------------------------------------------------------------------------------------------------

function head(t, st, k) {
  return html`<div class="round-head">
  <span class="badge">${roundLabel(t, st)}</span>
  <span class="round-tools"><span class="round-total" aria-label="${t('rounds.total_label')}"><b class="anim" data-total>${fmtTotal(st.total)}</b> ${t('rounds.pts')}</span>
  <button class="icon-btn" type="button" data-sound-toggle aria-pressed="${String(site()?.soundOn() ?? true)}" aria-label="${t('rounds.sound')}">${SPEAKER}</button></span>
</div>
<div class="progress"><progress value="${k}" max="${st.items.length}" aria-hidden="true"></progress><span>${t('rounds.progress', { i: k + 1, n: st.items.length })}</span></div>`;
}

function showItem(ctx, st, k) {
  const { app, t } = ctx;
  const item = st.items[k];
  const t0 = performance.now();
  app.innerHTML = html`${head(t, st, k)}
<h2 class="q" tabindex="-1">${item.prompt}</h2>
<div class="picks">${[item.a, item.b].map((name, c) => html`<button type="button" class="pick" data-c="${c}" aria-pressed="false"><span class="letter" aria-hidden="true">${'AB'[c]}</span><span class="name">${name}</span></button>`)}</div>
<div id="conf" hidden>
  <p class="sub">${t('rounds.how_sure')}</p>
  <div class="conf" role="group" aria-label="${t('rounds.how_sure')}">${CONFS.map((c) => html`<button type="button" class="anim" data-conf="${c}" aria-pressed="false">${c}%</button>`)}</div>
  <p class="ends"><span>${t('rounds.coin_flip')}</span><span>${t('rounds.stake')}</span></p>
</div>`;
  app.querySelector('.q').focus();
  let choice = null;
  const picks = [...app.querySelectorAll('.pick')];
  for (const b of picks) {
    b.onclick = () => {
      choice = Number(b.dataset.c);
      for (const o of picks) o.setAttribute('aria-pressed', String(o === b));
      app.querySelector('#conf').hidden = false;
    };
  }
  const confButtons = [...app.querySelectorAll('[data-conf]')];
  for (const b of confButtons) {
    b.onclick = () => {
      if (choice === null) return;
      sound.tick(); // inside the tap, so the audio context may start
      b.setAttribute('aria-pressed', 'true'); // the chosen one stays raised while the answer is sent
      for (const x of app.querySelectorAll('button:not([data-sound-toggle])')) x.disabled = true;
      keys = null;
      sendAnswer(ctx, st, k, choice, Number(b.dataset.conf), Math.round(performance.now() - t0));
    };
  }
  keys = (key) => {
    if (key === 'a' || key === 'b') picks['ab'.indexOf(key)].click();
    else if (key in CONF_KEYS && choice !== null) confButtons.find((b) => Number(b.dataset.conf) === CONF_KEYS[key]).click();
  };
}

async function sendAnswer(ctx, st, k, choice, conf, rtMs) {
  const item = st.items[k];
  const r = await api('/api/round/answer', {
    method: 'POST', body: { round_id: st.round_id, item_id: item.id, choice, conf, rt_ms: rtMs, anon_id: anonId(), surface: 'web' },
  });
  if (!r.ok) return retryScreen(ctx, r.status === 400 ? r.data?.error ?? ctx.t('rounds.offline') : ctx.t('rounds.offline'), () => showItem(ctx, st, k));
  // The server keeps the first answer; show what it scored (a resend after a lost reply returns that one).
  const a = { choice: r.data.choice, conf: r.data.conf, correct: r.data.correct, points: r.data.points, truth: r.data.truth };
  const sofar = st.items.slice(0, k).map((i) => st.answers[i.id]).filter(Boolean);
  const used = new Set(Object.values(st.answers).map((x) => x.template).filter(Boolean));
  const said = pickReaction([...sofar, a], sofar.length, st.items.length, used, { mild: Boolean(site()?.classMode) });
  const before = st.total;
  const next = { ...st, total: r.data.total, answers: { ...st.answers, [item.id]: { ...a, line: said.text, template: said.template } } };
  saveRound(next);
  return showReveal(ctx, next, k, before);
}

// The reveal of answer k: both values with sources (and the AI pack's "Did you know" fact, when the pair has one), the
// verdict and the points counting to their value, the game's line, and the motion that goes with it (a green sweep and confetti when right, a shake, a red flash and a BLUFF stamp
// when wrong, a gold "Called it" at 100% right). Sounds: a ding or a womp.
function showReveal(ctx, st, k, before) {
  const { app, t } = ctx;
  const item = st.items[k];
  const a = st.answers[item.id];
  const truthIndex = a.correct ? a.choice : 1 - a.choice;
  const values = [a.truth.a_value, a.truth.b_value];
  const sources = [a.truth.a_source, a.truth.b_source];
  const last = k + 1 === st.items.length;
  const motion = (c) => {
    if (c === truthIndex) return ' anim anim-sweep';
    if (c === a.choice) return ` anim anim-shake${a.conf >= CONFIDENT_MISS ? ' anim-flash' : ''}`;
    return '';
  };
  const stamp = (c) => {
    if (!a.correct && c === a.choice) return html`<span class="stamp stamp-bluff anim anim-stamp" data-stake="${a.conf}" aria-hidden="true">${t('rounds.stamp_bluff')}</span>`;
    if (a.correct && a.conf === 100 && c === truthIndex) return html`<span class="stamp stamp-called anim anim-stamp" aria-hidden="true">${t('rounds.stamp_called')}</span>`;
    return '';
  };
  app.innerHTML = html`${head(t, { ...st, total: before }, k)}
<h2 class="q">${item.prompt}</h2>
<div class="picks revealed">${[item.a, item.b].map((name, c) => html`<div class="pick${c === truthIndex ? ' is-true' : ''}${c === a.choice ? ' is-chosen' : ''}${motion(c)}">
  <span class="letter" aria-hidden="true">${c === truthIndex ? '✓' : 'AB'[c]}</span>
  <span class="name">${name}<span class="value">${fmtValue(values[c], a.truth.unit)}</span><a class="src" href="${sources[c]}" target="_blank" rel="noopener noreferrer">${t('rounds.source')}</a></span>${stamp(c)}
</div>`)}</div>
${a.truth.fun ? html`<p class="fun"><span class="fun-label">${t('rounds.fun_label')}</span> ${a.truth.fun}</p>` : ''}
<section class="reveal ${a.correct ? 'is-hit' : 'is-miss'}" aria-live="polite">
  <p class="verdict">${a.correct ? `✓ ${t('rounds.right')}` : `✗ ${t('rounds.wrong')}`} <span class="muted">${t('rounds.at_conf', { conf: a.conf })}</span></p>
  <p class="pts anim ${a.points > 0 ? 'up' : a.points < 0 ? 'down' : ''}" data-points>${fmtPoints(a.points)}</p>
  ${a.line ? html`<p class="reaction">${a.line}</p>` : ''}
</section>
<button id="next" class="primary block" type="button">${last ? t('rounds.see_score') : t('rounds.next')}</button>
<div id="flag"></div>`;
  if (a.correct) sound.ding(a.conf); else sound.womp(a.conf);
  if (a.correct) confetti(app.querySelector('.reveal'), { big: a.conf === 100 });
  countTo(app.querySelector('[data-points]'), 0, a.points, { format: fmtPoints });
  const total = app.querySelector('[data-total]');
  countTo(total, before, st.total, { ms: 450, format: fmtTotal }).then(() => { if (before !== st.total) total.classList.add('anim-tick'); });
  const nextBtn = app.querySelector('#next');
  nextBtn.onclick = () => (last ? finish(ctx, st) : step(ctx, st));
  nextBtn.focus({ preventScroll: true });
  keys = (key, e) => { if (key === 'n' || (key === 'enter' && !e.target.closest?.('button, a, summary'))) nextBtn.click(); };
  flagForm(ctx, app.querySelector('#flag'), item.id, st.round_id);
}

function flagForm(ctx, el, itemId, roundId) {
  const { t } = ctx;
  el.innerHTML = html`<details class="flag"><summary>${t('rounds.flag')}</summary>
<form class="row" novalidate><input name="reason" maxlength="280" autocomplete="off" placeholder="${t('rounds.flag_reason')}" aria-label="${t('rounds.flag_reason')}"><button type="submit">${t('rounds.flag_send')}</button></form>
<p class="msg ok" role="status"></p></details>`;
  const form = el.querySelector('form');
  form.onsubmit = async (e) => {
    e.preventDefault();
    const r = await api('/api/flag', { method: 'POST', body: { item_id: itemId, round_id: roundId, anon_id: anonId(), reason: form.reason.value.trim() } });
    el.querySelector('.msg').textContent = r.ok ? t('rounds.flag_thanks') : t('rounds.flag_failed');
    if (r.ok) form.hidden = true;
  };
}

// Next unanswered pair, or the end of the round.
function step(ctx, st) {
  const k = st.items.findIndex((it) => !st.answers[it.id]);
  if (k === -1) return finish(ctx, st);
  ctx.chrome(false);
  window.scrollTo(0, 0);
  return showItem(ctx, st, k);
}

// --- starting rounds ----------------------------------------------------------------------------------------------

function begin(ctx, round, extra = {}) {
  if (!round.items.length) return retryScreen(ctx, ctx.t('rounds.failed'), () => location.reload());
  const st = { round_id: round.round_id, mode: round.mode, date: round.date, items: round.items, answers: {}, total: 0,
    ...(round.mode === 'quick' && { pack: round.pack ?? 'all', difficulty: round.difficulty ?? 'normal' }), ...extra };
  saveRound(st);
  return step(ctx, st);
}

// A new quick round in the chosen pack and difficulty, fetched on the tap (creating one writes a row, so it is never
// prefetched). A choice the server refuses (a pack that no longer fills that difficulty) falls back to All, Normal.
async function playQuick(ctx) {
  ctx.chrome(false);
  window.scrollTo(0, 0);
  ctx.app.innerHTML = html`<p class="muted" role="status">${ctx.t('rounds.loading')}</p>`;
  const seen = encodeURIComponent(store.get(SEEN_KEY, []).join(','));
  const { pack, difficulty } = (picker ??= initPicker()).current();
  let r = await api(`/api/round?mode=quick&pack=${encodeURIComponent(pack)}&difficulty=${encodeURIComponent(difficulty)}&seen=${seen}`);
  if (r.status === 400) r = await api(`/api/round?mode=quick&seen=${seen}`);
  if (!r.ok) {
    ctx.chrome(true);
    return retryScreen(ctx, ctx.t('rounds.failed'), () => playQuick(ctx));
  }
  return begin(ctx, r.data);
}

// --- the end of a round -----------------------------------------------------------------------------------------

async function finish(ctx, st) {
  const { app, t } = ctx;
  keys = null;
  app.innerHTML = html`<p class="muted" role="status">${t('rounds.sending')}</p>`;
  const nick = store.get(NICK_KEY, null);
  const body = { round_id: st.round_id, anon_id: anonId(), surface: 'web' };
  if (nick) body.nickname = nick;
  if (st.challenge) body.challenge = st.challenge;
  const r = await api('/api/round/complete', { method: 'POST', body });
  if (!r.ok) return retryScreen(ctx, t('rounds.offline'), () => finish(ctx, st));
  // A dare is played once and stays out of the quick rounds' seen pairs; its link is its page, not a challenge token.
  if (r.data.dare) store.set(DARES_KEY, { ...store.get(DARES_KEY, {}), [st.round_id]: r.data.score });
  else store.set(SEEN_KEY, addSeen(store.get(SEEN_KEY, []), st.items.map((i) => i.id)));
  if (st.mode === 'ranked') rememberRanked(st.date, r.data.score);
  const token = r.data.challenge_url.split('/').at(-1);
  if (!r.data.dare) store.set(MINE_KEY, [...store.get(MINE_KEY, []).filter((x) => x !== token), token].slice(-KEEP_MINE));
  clearRound();
  return showEnd(ctx, st, r.data);
}

// The end screen's three tiles; the numbers count up from 0 (data-to).
function counters(t, res) {
  const tile = (to, prefix, suffix, label) => html`<div><b class="anim" data-to="${to}" data-prefix="${prefix}" data-suffix="${suffix}">${prefix}${to}${suffix}</b><span>${label}</span></div>`;
  return html`<div class="counters">
  ${tile(res.streak, '', '', t('rounds.streak'))}
  ${res.rank_today ? tile(res.rank_today, '#', '', t('rounds.rank_of', { players: res.players_today }))
    : res.dare ? tile(res.rank, '#', '', dareRankLabel(res.players, res.dare.address))
      : html`<div><b>–</b><span>${t('rounds.rank_quick')}</span></div>`}
  ${tile(Math.round(res.accuracy), '', '%', t('rounds.right_label'))}
</div>`;
}

function showEnd(ctx, st, res) {
  const { app, t } = ctx;
  ctx.chrome(true);
  ctx.setPlay(t('rounds.play_again'), () => playAgain(ctx));
  const answers = st.items.map((i) => st.answers[i.id]).filter(Boolean);
  const calib = bins(answers.map((a) => a.conf / 100), answers.map((a) => (a.correct ? 1 : 0)));
  app.innerHTML = html`<h2 class="result-title">${t('rounds.score_title', { score: fmtTotal(res.score) })}</h2>
<p class="round-kind">${roundLabel(t, st)}</p>
${resultGrid(st, t)}
<section class="type-card type-${TYPES[res.type]} anim anim-flip" aria-label="${t('rounds.type_label')}">
  <p class="type-name">${typeName(res.type)}</p>
  <p class="type-def">${t(typeKey(res.type))}</p>
  <p class="type-line">${t('rounds.score_sub', { accuracy: Math.round(res.accuracy), mean_conf: Math.round(res.mean_conf) })} · ${t('rounds.overconf', { x: signed(Math.round(res.overconfidence)) })}</p>
</section>
${boardOf(st) ? sideBlock(st.pack, t, savedSide(st.pack)) : ''}
${res.roast ? html`<p class="roast">${res.roast}</p>` : ''}
${counters(t, res)}
<figure class="mini">${calibrationChart([{ name: t('rounds.you'), bins: calib, cls: 's0' }], chartLabels(t))}<figcaption>${t('rounds.chart_note')}</figcaption></figure>
<div class="end-actions">
  <button class="primary" type="button" data-act="again">${t('rounds.play_again')}</button>
  <button type="button" data-act="challenge">${t('rounds.challenge')}</button>
  <button type="button" data-act="share" aria-expanded="false" aria-controls="share-panel">${t('rounds.share')}</button>
  <button type="button" data-act="board" aria-expanded="false" aria-controls="board-panel">${t('rounds.leaderboard')}</button>
</div>
<div id="challenge-panel" class="card" hidden></div>
<div id="vs-panel" class="card" hidden></div>
<section id="share-panel" class="card" hidden></section>
<section id="board-panel" class="card" hidden></section>`;
  app.scrollIntoView(); // the result sits below the hero, which is back now
  wireGrid(app, st, t);
  const side = boardOf(st) ? wireSide(st.pack, app, st.round_id, t) : null; // quick rounds of a pack with a board only
  for (const b of app.querySelectorAll('.counters [data-to]')) {
    countTo(b, 0, Number(b.dataset.to), { ms: 700, format: (n) => `${b.dataset.prefix}${n}${b.dataset.suffix}` });
  }
  if (res.score > 0) sound.fanfare();
  const panel = (id) => app.querySelector(`#${id}`);
  const toggle = (btn, el, fill) => {
    const open = el.hidden;
    el.hidden = !open;
    btn.setAttribute('aria-expanded', String(open));
    if (open && !el.dataset.filled) { el.dataset.filled = '1'; fill(el); }
  };
  const acts = Object.fromEntries([...app.querySelectorAll('[data-act]')].map((b) => [b.dataset.act, b]));
  acts.again.onclick = () => playAgain(ctx);
  acts.challenge.onclick = () => challengeFriend(ctx, panel('challenge-panel'), res, st);
  const copy = res.dare ? res.share_text // the dare's sentence as the server wrote it
    : shareWith(res.share_text, { pack: st.mode === 'quick' ? st.pack : null, line: bestLine(st.items, st.answers), url: res.challenge_url, type: res.type });
  acts.share.onclick = () => toggle(acts.share, panel('share-panel'), (el) => renderRoundShare(ctx, el, {
    lines: { kicker: st.mode === 'ranked' ? t('rounds.ranked') : t('rounds.card_kicker'), type: typeName(res.type), score: t('rounds.card_score', { score: fmtTotal(res.score) }),
      line: t('rounds.score_sub', { accuracy: Math.round(res.accuracy), mean_conf: Math.round(res.mean_conf) }), cta: t('rounds.card_cta') },
    copy: withSideLine(copy, side?.shareLine(), res.challenge_url), url: res.challenge_url, onShare: () => event('share', st.round_id),
  }));
  acts.board.onclick = () => toggle(acts.board, panel('board-panel'), (el) => leaderboard(ctx, el, res.today));
  if (st.mode === 'ranked') acts.board.click(); // the ranked round ends with its leaderboard
  if (st.challenge) showVs(ctx, panel('vs-panel'), st.round_id, st.challenge);
}

const event = (type, roundId) => api('/api/event', { method: 'POST', body: { type, round_id: roundId } });

function playAgain(ctx) {
  event('play_again');
  return playQuick(ctx);
}

// Copies the challenge link; the first time, asks once for an optional nickname (kept in this browser).
function challengeFriend(ctx, el, res, st) {
  const { t } = ctx;
  const copy = () => navigator.clipboard.writeText(res.challenge_url);
  const done = (ok) => {
    el.hidden = false;
    el.innerHTML = html`<p class="msg ${ok ? 'ok' : ''}" role="status">${ok ? t('rounds.copied') : t('rounds.copy_failed')}</p><p class="url small">${res.challenge_url}</p>`;
  };
  const tryCopy = () => { try { copy().then(() => done(true), () => done(false)); } catch { done(false); } };
  if (store.get(NICK_KEY, null) !== null) { tryCopy(); return; }
  el.hidden = false;
  el.innerHTML = html`<form class="nick" novalidate>
  <label>${t('rounds.nick_label')}<input name="nick" maxlength="24" autocomplete="nickname" placeholder="${t('rounds.nick_placeholder')}"></label>
  <p class="muted small">${t('rounds.nick_note')}</p>
  <div class="row"><button class="primary" type="submit">${t('rounds.copy_link')}</button><button type="button" data-skip>${t('rounds.skip')}</button></div>
</form>`;
  const form = el.querySelector('form');
  const save = (nick) => {
    store.set(NICK_KEY, nick);
    tryCopy(); // synchronously inside the click
    if (nick) api('/api/round/complete', { method: 'POST', body: { round_id: st.round_id, anon_id: anonId(), surface: 'web', nickname: nick } });
  };
  form.onsubmit = (e) => {
    e.preventDefault();
    const nick = form.nick.value.trim().replace(/\s+/g, ' ');
    save(/^[\p{L}\p{N} .'_-]{1,24}$/u.test(nick) ? nick : '');
  };
  form.querySelector('[data-skip]').onclick = () => save('');
}

// fresh: the day's stats from a ranked complete (includes you); otherwise /api/round/stats (cached up to 60 s).
// Its rows slide in one after another.
async function leaderboard(ctx, el, fresh) {
  const { t } = ctx;
  el.innerHTML = html`<p class="muted">…</p>`;
  const r = fresh ? { ok: true, data: fresh } : await api('/api/round/stats');
  if (!r.ok) { el.innerHTML = html`<p class="msg">${t('rounds.board_failed')}</p>`; return; }
  const s = r.data;
  const mine = store.get(RANKED_KEY, {})[s.date] ?? null;
  el.innerHTML = s.players
    ? html`<h3 class="anim anim-slide">${t('rounds.board_title')}</h3>
<p class="anim anim-slide">${t('rounds.board_line', { players: s.players.toLocaleString('en-US'), x: signed(Math.round(s.mean_overconfidence)) })}</p>
<figure class="anim anim-slide">${scoreChart(s, mine, t('rounds.board_chart'))}<figcaption>${mine == null ? t('rounds.board_play') : t('rounds.board_you', { score: fmtTotal(mine) })}</figcaption></figure>`
    : html`<h3 class="anim anim-slide">${t('rounds.board_title')}</h3><p class="anim anim-slide">${t('rounds.board_empty')}</p>`;
}

// You against the challenger: rows slide in, and the two scores race up to their values.
async function showVs(ctx, el, roundId, token) {
  const { t } = ctx;
  const r = await api(`/api/round/${encodeURIComponent(roundId)}/compare?me=${encodeURIComponent(anonId())}&them=${encodeURIComponent(token)}`);
  if (!r.ok || !r.data.me) return;
  const { me, them } = r.data;
  const name = them.nickname || t('rounds.vs_someone');
  const d = me.score - them.score;
  const row = (label, f) => html`<tr class="anim anim-slide"><th scope="row">${label}</th><td>${f(me)}</td><td>${f(them)}</td></tr>`;
  const hero = location.pathname.startsWith('/c/') && document.getElementById('hero-title');
  if (hero) hero.textContent = t('rounds.vs_hero', { me: me.score, name, them: them.score }); // the challenge is played now
  el.hidden = false;
  el.innerHTML = html`<h3>${t('rounds.vs_title', { name })}</h3>
<p class="headline">${d > 0 ? t('rounds.vs_win', { d }) : d < 0 ? t('rounds.vs_lose', { name, d: -d }) : t('rounds.vs_tie')}</p>
<table class="vs"><thead><tr><td></td><th scope="col">${t('rounds.you')}</th><th scope="col">${name}</th></tr></thead><tbody>
<tr class="anim anim-slide vs-score"><th scope="row">${t('rounds.vs_score')}</th><td><b class="anim" data-race="${me.score}">${me.score}</b></td><td><b class="anim" data-race="${them.score}">${them.score}</b></td></tr>
${row(t('rounds.vs_type'), (p) => typeName(p.type))}
${row(t('rounds.vs_right'), (p) => `${Math.round(p.accuracy)}%`)}
${row(t('rounds.vs_sure'), (p) => `${Math.round(p.mean_conf)}%`)}
</tbody></table>`;
  raceTo([...el.querySelectorAll('[data-race]')].map((b) => ({ el: b, to: Number(b.dataset.race), format: String })));
}

// --- entry points -----------------------------------------------------------------------------------------------

// `/`: the Play buttons start today's ranked round if it is still to play (prefetched: reading it writes nothing), else
// a quick round in the picked pack and difficulty; an unfinished round from today resumes. A pick on the page dares
// that round, as a link with ?pack= does: Play then starts a quick round.
export async function renderRounds(ctx) {
  const { app, t } = ctx;
  app.replaceChildren();
  bindKeys();
  let picked = false;
  picker = initPicker(document, { onPick: () => { picked = true; } });
  const today = todayUTC();
  const saved = loadRound();
  if (saved && saved.date === today && !saved.challenge && saved.items.some((i) => !saved.answers[i.id])) {
    const done = saved.items.filter((i) => saved.answers[i.id]).length;
    ctx.setPlay(t('rounds.continue', { done, n: saved.items.length }), () => step(ctx, saved));
    return;
  }
  if (saved) clearRound();
  // A link that names a pack or difficulty (?pack=ai&difficulty=brutal) is a dare to that round: quick at once.
  const linked = ['pack', 'difficulty'].some((k) => new URLSearchParams(location.search).has(k));
  if (linked || store.get(RANKED_KEY, {})[today] != null) {
    ctx.setPlay(t('rounds.play'), () => playQuick(ctx));
    return;
  }
  const r = await api('/api/round?mode=ranked');
  ctx.setPlay(t('rounds.play'), () => (r.ok && r.data.items.length && !picked ? begin(ctx, r.data) : playQuick(ctx)));
}

// `/c/<round>/<token>`: plays the challenger's round, then shows the side-by-side. A finished round shows it at once.
export async function renderChallenge(ctx, roundId, token) {
  const { app, t } = ctx;
  app.replaceChildren();
  bindKeys();
  if (store.get(MINE_KEY, []).includes(token)) {
    app.innerHTML = html`<p class="note">${t('rounds.own_link')}</p><p class="url small">${location.href}</p>`;
    ctx.setPlay(t('rounds.play'), () => playQuick(ctx));
    return;
  }
  const saved = loadRound();
  if (saved?.round_id === roundId && saved.challenge === token && saved.items.some((i) => !saved.answers[i.id])) {
    const done = saved.items.filter((i) => saved.answers[i.id]).length;
    ctx.setPlay(t('rounds.continue', { done, n: saved.items.length }), () => step(ctx, saved));
    return;
  }
  const vs = await api(`/api/round/${encodeURIComponent(roundId)}/compare?me=${encodeURIComponent(anonId())}&them=${encodeURIComponent(token)}`);
  if (vs.ok && vs.data.me) {
    app.innerHTML = html`<div id="vs-panel" class="card"></div>`;
    showVs(ctx, app.querySelector('#vs-panel'), roundId, token);
    ctx.setPlay(t('rounds.play_again'), () => playQuick(ctx));
    return;
  }
  const r = await api(`/api/round?round_id=${encodeURIComponent(roundId)}`);
  if (!r.ok) {
    app.innerHTML = html`<p class="msg">${t('rounds.challenge_gone')}</p>`;
    ctx.setPlay(t('rounds.play'), () => playQuick(ctx));
    return;
  }
  ctx.setPlay(t('rounds.play'), () => begin(ctx, r.data, { challenge: token }));
}

// `/dare/<slug>` (HTML from functions/dare/[slug].js): plays the dare's fixed round dr-<slug>; an unfinished one
// resumes. A browser that has finished it gets a quick round instead (the server keeps the first answers).
export async function renderDare(ctx, slug) {
  const { app, t } = ctx;
  const roundId = `dr-${slug}`;
  app.replaceChildren();
  bindKeys();
  const saved = loadRound();
  if (saved?.round_id === roundId && saved.items.some((i) => !saved.answers[i.id])) {
    const done = saved.items.filter((i) => saved.answers[i.id]).length;
    ctx.setPlay(t('rounds.continue', { done, n: saved.items.length }), () => step(ctx, saved));
    return;
  }
  const score = store.get(DARES_KEY, {})[roundId];
  if (score != null) {
    app.innerHTML = html`<p class="note">${dareDone(score)}</p>`;
    ctx.setPlay(t('rounds.play'), () => playQuick(ctx));
    return;
  }
  const r = await api(`/api/round?round_id=${encodeURIComponent(roundId)}`);
  if (!r.ok) {
    app.innerHTML = html`<p class="msg">${t('rounds.failed')}</p>`;
    ctx.setPlay(t('rounds.play'), () => playQuick(ctx));
    return;
  }
  ctx.setPlay(t('rounds.play'), () => begin(ctx, r.data, { pack: r.data.pack, difficulty: r.data.difficulty }));
}
