// Classroom mode: /class creates a code; /class/d/<secret> is the teacher's live dashboard (aggregates only).
import { html, api, pct, signed, calibrationChart, histChart, chartLabels } from './ui.js';

const POLL_MS = 10000;

function showCreated(ctx, el, d) {
  const { t } = ctx;
  const host = `${new URL(d.join_url).host}/test`;
  el.innerHTML = html`<section class="card">
  <p class="label">${t('class.code')}</p>
  <p class="code">${d.code}</p>
  <p class="label">${t('class.join_link')}</p>
  <p class="url">${d.join_url}</p>
  <p class="label">${t('class.dash_link')}</p>
  <p class="url"><a href="${d.dashboard_url}">${d.dashboard_url}</a></p>
  <p class="warn">${t('class.private')}</p>
</section>
<section class="card">
  <h2>${t('class.project_title')}</h2>
  <p>${t('class.project_1', { url: host, code: d.code })}</p>
  <p>${t('class.project_2')}</p>
  <a class="button primary block" href="${d.dashboard_url}">${t('class.open_dash')}</a>
</section>`;
}

export function renderClassCreate(ctx) {
  const { app, t } = ctx;
  app.innerHTML = html`<h1>${t('class.title')}</h1>
<p>${t('class.lead')}</p>
<form class="stack" novalidate>
  <label>${t('class.label')}<input name="label" maxlength="80" autocomplete="off" placeholder="${t('class.label_placeholder')}"></label>
  <button class="primary block" type="submit">${t('class.create')}</button>
  <p class="msg" role="alert"></p>
</form>
<div id="created"></div>`;
  const form = app.querySelector('form');
  form.onsubmit = async (e) => {
    e.preventDefault();
    const button = form.querySelector('button');
    button.disabled = true;
    const label = form.label.value.trim();
    const r = await api('/api/class', { method: 'POST', body: label ? { label } : {} });
    button.disabled = false;
    if (!r.ok) { form.querySelector('.msg').textContent = t('class.create_failed'); return; }
    form.hidden = true;
    showCreated(ctx, app.querySelector('#created'), r.data);
  };
}

function dashboardBody(ctx, d, secret) {
  const { t } = ctx;
  if (!d.bins) return html`<p class="big">${t('dash.waiting', { n: d.n })}</p>`;
  return html`<p class="big">${t('dash.n', { n: d.n })}</p>
<p>${t('dash.overconf', { x: signed(Math.round(d.overconf_mean * 100)) })}</p>
<p>${t('dash.int_hit', { h: pct(d.int_hit_mean) })}</p>
<figure>${calibrationChart([{ name: t('dash.series'), bins: d.bins, cls: 's0' }], chartLabels(t))}</figure>
<h2>${t('dash.hist_title')}</h2>
<figure>${histChart(d.overconf_hist, { title: t('dash.hist_title'), x: t('dash.hist_x') })}</figure>
<p><a href="/api/class/d/${secret}.csv" download>${t('dash.csv')}</a></p>`;
}

export function renderDashboard(ctx, secret) {
  const { app, t } = ctx;
  app.innerHTML = html`<h1>${t('dash.title')}</h1>
<div id="dash" class="dash" aria-live="polite"><p class="muted">…</p></div>
<p id="dash-status" class="muted small">${t('dash.refresh')}</p>`;
  const body = app.querySelector('#dash');
  const status = app.querySelector('#dash-status');
  let timer = null;
  const tick = async () => {
    const r = await api(`/api/class/d/${secret}`);
    if (r.status === 404) {
      clearInterval(timer);
      body.innerHTML = html`<p class="msg">${t('dash.not_found')}</p>`;
      return;
    }
    status.textContent = r.ok ? t('dash.refresh') : t('dash.offline');
    if (r.ok) body.innerHTML = dashboardBody(ctx, r.data, secret);
  };
  timer = setInterval(tick, POLL_MS);
  tick();
}
