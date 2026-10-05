// Pieces of a finished round's end screen: the result grid (one square per question, green right, red wrong) and the
// detail card a square opens, and after an AI-pack round the lab block (the one piece that calls the API). Pure HTML
// builders plus wiring functions, so node tests can render them. st = the round state of rounds.js: {items: [{id,
// prompt, a, b}], answers: {id: {choice, conf, correct, points, truth, line}}}.
import { html, fmtValue, api, store, anonId } from './ui.js';
import { LABS } from './packs.js';

export { fmtValue }; // the shared formatter: years, months, dollars, big counts (ui.js)
export const fmtPoints = (p) => (p > 0 ? `+${p}` : p < 0 ? `−${-p}` : '0');

// The squares pop in one after another (styles.css staggers them); misses shake once after their pop.
export function resultGrid(st, t) {
  return html`<div class="result-grid" role="group" aria-label="${t('rounds.grid_label')}">${st.items.map((it, k) => {
    const a = st.answers[it.id];
    if (!a) return '';
    const label = t('rounds.sq_label', { i: k + 1, verdict: a.correct ? t('rounds.right') : t('rounds.wrong'), conf: a.conf, points: fmtPoints(a.points) });
    return html`<button type="button" class="sq anim anim-pop${a.correct ? '' : ' miss anim-shake'}" data-k="${k}" aria-expanded="false" aria-controls="sq-detail" aria-label="${label}"></button>`;
  })}</div>
<div class="sq-detail card" id="sq-detail" aria-live="polite" hidden></div>`;
}

// The question behind square k: the prompt, your pick and confidence, both true values with sources (and the reveal
// fact, when the pair has one), the points and the line the game said.
export function detailCard(st, k, t) {
  const it = st.items[k];
  const a = st.answers[it.id];
  const truth = a.correct ? a.choice : 1 - a.choice;
  const names = [it.a, it.b];
  const values = [a.truth.a_value, a.truth.b_value];
  const sources = [a.truth.a_source, a.truth.b_source];
  return html`<p class="sq-n">${t('rounds.detail_n', { i: k + 1, n: st.items.length })}</p>
<h3 class="sq-q">${it.prompt}</h3>
<p class="sq-pick">${t('rounds.detail_pick', { letter: 'AB'[a.choice], name: names[a.choice], conf: a.conf })}</p>
<ul class="sq-truth">${[0, 1].map((c) => html`<li class="${c === truth ? 'is-true' : ''}"><span class="name">${c === truth ? '✓ ' : ''}${names[c]}</span>: ${fmtValue(values[c], a.truth.unit)} <a href="${sources[c]}" target="_blank" rel="noopener noreferrer">${t('rounds.source')}</a></li>`)}</ul>
${a.truth.fun ? html`<p class="fun"><span class="fun-label">${t('rounds.fun_label')}</span> ${a.truth.fun}</p>` : ''}
<p class="sq-pts ${a.correct ? 'hit' : 'miss'}">${a.correct ? t('rounds.right') : t('rounds.wrong')} · ${fmtPoints(a.points)} ${t('rounds.pts')}</p>
${a.line ? html`<p class="reaction">${a.line}</p>` : ''}`;
}

// A square opens its question's card below the grid; the same square (or Escape inside the card) closes it.
export function wireGrid(root, st, t) {
  const card = root.querySelector('#sq-detail');
  const squares = [...root.querySelectorAll('.sq')];
  let open = -1;
  const show = (k) => {
    open = k;
    for (const s of squares) {
      const on = Number(s.dataset.k) === k;
      s.setAttribute('aria-expanded', String(on));
      s.classList.toggle('is-open', on);
    }
    card.hidden = k < 0;
    card.innerHTML = k < 0 ? '' : detailCard(st, k, t);
  };
  for (const s of squares) s.addEventListener('click', () => show(Number(s.dataset.k) === open ? -1 : Number(s.dataset.k)));
  card.addEventListener('keydown', (e) => {
    if (e.key !== 'Escape' || open < 0) return;
    const back = squares.find((s) => Number(s.dataset.k) === open);
    show(-1);
    back?.focus();
  });
}

// --- after an AI-pack round: "Which lab are you with?" ----------------------------------------------------------------
// Six chips; a tap claims the round for that lab (POST /api/round/lab), presses the chip and shows the mini board. The
// lab is kept in this browser (whosbluffing_lab) and later AI rounds claim it at once, showing "You're with {lab} ·
// change". board = the body of GET /api/labs: {min_players, labs: [{lab, name, players, mean_score, mean_overconfidence}]}.
export const LAB_KEY = 'whosbluffing_lab';
export const savedLab = () => {
  const lab = store.get(LAB_KEY, null);
  return typeof lab === 'string' && Object.hasOwn(LABS, lab) ? lab : null;
};
const fmtScore = (n) => (n < 0 ? `−${-n}` : String(n));

// Overconfidence in words: "12 points more sure than right", "as sure as right", "1 point less sure than right".
export function overWords(x, t) {
  const n = Math.round(x);
  if (n > 1) return t('labs.over_more', { x: n });
  if (n === 1) return t('labs.over_more_one');
  if (n === -1) return t('labs.over_less_one');
  if (n < -1) return t('labs.over_less', { x: -n });
  return t('labs.over_even');
}

// The board as a table in the API's order: players, then the average score (full: and the overconfidence in words), or
// how many more players the lab needs. `mine` (the player's lab) is highlighted.
export function labTable(board, mine, t, { full = false } = {}) {
  const row = (l) => {
    const need = board.min_players - l.players;
    const means = l.mean_score === null
      ? html`<td class="lab-need" colspan="${full ? 2 : 1}">${need === 1 ? t('labs.need_one') : t('labs.need', { k: need })}</td>`
      : html`<td>${fmtScore(Math.round(l.mean_score))}</td>${full ? html`<td>${overWords(l.mean_overconfidence, t)}</td>` : ''}`;
    return html`<tr class="${l.lab === mine ? 'is-mine' : ''}"><th scope="row">${l.name}${l.lab === mine ? html` <span class="lab-you">${t('labs.yours')}</span>` : ''}</th><td>${l.players.toLocaleString('en-US')}</td>${means}</tr>`;
  };
  return html`<table class="vs lab-table"><thead><tr><th scope="col">${t('labs.col_lab')}</th><th scope="col">${t('labs.col_players')}</th><th scope="col">${t('labs.col_score')}</th>${full ? html`<th scope="col">${t('labs.col_over')}</th>` : ''}</tr></thead>
<tbody>${board.labs.map(row)}</tbody></table>`;
}

// The share text's lab line, once the player's lab has an average (min_players claims), else null.
export function labShareLine(board, lab, t) {
  const l = board?.labs.find((x) => x.lab === lab);
  return l && l.mean_score !== null ? t('labs.share_line', { lab: l.name, score: fmtScore(Math.round(l.mean_score)) }) : null;
}

// The share text with the lab line before the link, so the link stays last; unchanged without a line.
export function withLabLine(text, line, url) {
  if (!line) return text;
  const tail = [`\n${url}`, ` · ${url}`].find((x) => text.endsWith(x));
  return tail ? `${text.slice(0, -tail.length)}\n${line}\n${url}` : `${text}\n${line}`;
}

// lab: the saved lab (the chips wait behind "change"), or null (the question and the chips).
export function labBlock(t, lab) {
  return html`<section class="card lab-claim" aria-labelledby="lab-q">
  <h3 id="lab-q"${lab ? ' hidden' : ''}>${t('labs.question')}</h3>
  <p class="lab-with"${lab ? '' : ' hidden'}><span data-lab-with>${lab ? t('labs.with', { lab: LABS[lab] }) : ''}</span> · <button type="button" class="link" data-lab-change>${t('labs.change')}</button></p>
  <div class="chips lab-chips" role="group" aria-labelledby="lab-q"${lab ? ' hidden' : ''}>${Object.entries(LABS).map(([k, name]) => html`<button type="button" class="chip" data-lab="${k}" aria-pressed="${String(k === lab)}">${name}</button>`)}</div>
  <p class="msg" role="status"></p>
  <div data-lab-board></div>
  <p class="small"><a href="/labs">${t('labs.full_board')}</a></p>
</section>`;
}

// Wires the block under `root` for the round; a saved lab claims at once. Returns {shareLine()}.
export function wireLab(root, roundId, t) {
  const el = root.querySelector('.lab-claim');
  const chips = [...el.querySelectorAll('[data-lab]')];
  let lab = savedLab();
  let board = null;
  let busy = false;
  const claim = async (pick) => {
    if (busy) return;
    busy = true;
    const r = await api('/api/round/lab', { method: 'POST', body: { round_id: roundId, anon_id: anonId(), lab: pick } });
    busy = false;
    el.querySelector('.msg').textContent = r.ok ? '' : t('labs.save_failed');
    if (!r.ok) return;
    ({ lab, board } = r.data);
    store.set(LAB_KEY, lab);
    for (const c of chips) c.setAttribute('aria-pressed', String(c.dataset.lab === lab));
    el.querySelector('[data-lab-with]').textContent = t('labs.with', { lab: LABS[lab] });
    el.querySelector('[data-lab-board]').innerHTML = labTable(board, lab, t);
  };
  for (const c of chips) c.addEventListener('click', () => claim(c.dataset.lab));
  el.querySelector('[data-lab-change]').addEventListener('click', () => {
    el.querySelector('.lab-with').hidden = true;
    el.querySelector('#lab-q').hidden = false;
    el.querySelector('.lab-chips').hidden = false;
    (chips.find((c) => c.dataset.lab === lab) ?? chips[0]).focus();
  });
  if (lab) claim(lab);
  return { shareLine: () => labShareLine(board, lab, t) };
}
