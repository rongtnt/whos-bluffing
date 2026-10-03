// Entry point: loads strings and items, routes by path. / = daily game, /test = full assessment.
import { html, api } from './ui.js';
import { startTest } from './test.js';
import { renderDaily } from './daily.js';
import { renderStats } from './stats.js';
import { renderClassCreate, renderDashboard } from './class.js';

const app = document.getElementById('app');
const foot = document.getElementById('foot');

let strings = {};
let items = [];

function t(key, vars = {}) {
  const s = key.split('.').reduce((o, k) => o?.[k], strings);
  return typeof s === 'string' ? s.replace(/\{(\w+)\}/g, (m, k) => (k in vars ? vars[k] : m)) : key;
}

const NAV = [['/', 'nav.daily'], ['/test', 'nav.test'], ['/stats', 'nav.stats'], ['/class', 'nav.teach']];

// Footer links (all but the current page) are hidden while questions are on screen.
function chrome(visible) {
  foot.hidden = !visible;
  const here = location.pathname.replace(/\/$/, '') || '/';
  foot.innerHTML = html`${NAV.filter(([path]) => path !== here).map(([path, key], i) => html`${i ? ' · ' : ''}<a href="${path}">${t(key)}</a>`)}`;
}

const ctx = {
  app,
  t,
  get strings() { return strings; },
  get items() { return items; },
  chrome,
};

// /test: the 5-minute full assessment (?c=CODE pre-fills a class code).
function renderTestLanding() {
  const code = (new URLSearchParams(location.search).get('c') || '').toUpperCase().slice(0, 6);
  app.innerHTML = html`
<section>
  <h1>${t('landing.h1')}</h1>
  <p class="lead">${t('landing.lead')}</p>
  <p class="consent">${t('landing.consent')}</p>
  <button id="start" class="primary block" type="button">${t('landing.start')}</button>
</section>
<section class="card">
  <h2>${t('landing.join_title')}</h2>
  <form id="join" class="row" novalidate>
    <input id="code" name="code" value="${code}" maxlength="6" autocomplete="off" autocapitalize="characters" spellcheck="false" placeholder="${t('landing.code_placeholder')}" aria-label="${t('landing.code_placeholder')}">
    <button class="${code ? 'primary' : ''}" type="submit">${t('landing.join')}</button>
  </form>
  <p id="join-msg" class="msg" role="status"></p>
</section>
<p><a href="/class">${t('landing.teach')}</a></p>`;
  app.querySelector('#start').onclick = () => startTest(ctx, {});
  app.querySelector('#join').onsubmit = async (e) => {
    e.preventDefault();
    const value = app.querySelector('#code').value.trim().toUpperCase();
    const msg = app.querySelector('#join-msg');
    const r = await api(`/api/class/${encodeURIComponent(value || '-')}`);
    if (!r.ok) { msg.textContent = t('landing.code_offline'); return; }
    if (!r.data.exists) { msg.textContent = t('landing.code_unknown'); return; }
    startTest(ctx, { classCode: value, classLabel: r.data.label || value });
  };
}

function route() {
  chrome(true);
  const p = location.pathname;
  const dash = p.match(/^\/class\/d\/([A-Za-z0-9_-]{24})\/?$/);
  if (/^\/test\/?$/.test(p)) return renderTestLanding();
  if (/^\/stats\/?$/.test(p)) return renderStats(ctx);
  if (/^\/class\/?$/.test(p)) return renderClassCreate(ctx);
  if (dash) return renderDashboard(ctx, dash[1]);
  return renderDaily(ctx);
}

async function boot() {
  const load = (path) => fetch(path).then((r) => (r.ok ? r.json() : Promise.reject(new Error(path))));
  try {
    const [en, bank] = await Promise.all([load('/i18n/en.json'), load('/items.json')]);
    strings = en;
    items = bank.items;
  } catch {
    app.innerHTML = html`<p class="msg">Couldn't load HowSure. Check your connection and reload.</p>`;
    return;
  }
  document.title = t('meta.title');
  route();
}

boot();
