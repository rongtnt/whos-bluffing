// Pieces of a finished round's end screen that need no network: the result grid (one square per question, green right,
// red wrong) and the detail card a square opens. Pure HTML builders plus one wiring function, so node tests can render
// them. st = the round state of rounds.js: {items: [{id, prompt, a, b}], answers: {id: {choice, conf, correct, points,
// truth, line}}}.
import { html, fmtMonth } from './ui.js';

export const fmtValue = (v, unit) => {
  if (unit === 'year') return v < 0 ? `${-v} BC` : String(v);
  if (unit === 'month') return fmtMonth(v); // YYYYMM
  return `${v.toLocaleString('en-US', { maximumFractionDigits: 3 })} ${unit}`;
};
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
