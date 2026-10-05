// /labs: the self-reported lab board (GET /api/labs, cached 60 s): players per lab, and from 10 players the average
// score and the overconfidence in words, all time or the last 30 days. The table is the end screen's (round-end.js).
import { html, api } from './ui.js';
import { labTable, savedLab } from './round-end.js';

export async function renderLabs(ctx) {
  const { app, t } = ctx;
  app.innerHTML = html`<h1>${t('labs.title')}</h1>
<p class="lead">${t('labs.lead')}</p>
<div class="seg" role="group" aria-label="${t('labs.range_label')}"><button type="button" data-range="all" aria-pressed="true">${t('labs.all_time')}</button><button type="button" data-range="30d" aria-pressed="false">${t('labs.last_30')}</button></div>
<div class="lab-board" aria-live="polite"><p class="muted">…</p></div>
<p class="muted small">${t('labs.note')}</p>
<p><a class="button primary" href="/?pack=ai&amp;difficulty=brutal">${t('labs.play')}</a></p>`;
  const board = app.querySelector('.lab-board');
  const toggles = [...app.querySelectorAll('[data-range]')];
  let current = 'all';
  const show = async (range) => {
    current = range;
    for (const b of toggles) b.setAttribute('aria-pressed', String(b.dataset.range === range));
    const r = await api(`/api/labs?range=${range}`);
    if (range !== current) return; // a later tap won
    board.innerHTML = r.ok ? labTable(r.data, savedLab(), t, { full: true }) : html`<p class="msg">${t('labs.failed')}</p>`;
  };
  for (const b of toggles) b.addEventListener('click', () => show(b.dataset.range));
  await show('all');
}
