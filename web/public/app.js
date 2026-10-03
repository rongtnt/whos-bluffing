// Entry point: loads strings and items, routes by path, renders the landing page.
import { html, api } from './ui.js';
import { startTest } from './test.js';
import { renderStats } from './stats.js';
import { renderClassCreate, renderDashboard } from './class.js';

const app = document.getElementById('app');
const toggle = document.getElementById('lang-toggle');
const foot = document.getElementById('foot');

let lang = /^zh/i.test(navigator.language || '') ? 'zh' : 'en';
let strings = {};
let items = [];

function t(key, vars = {}) {
  const s = key.split('.').reduce((o, k) => o?.[k], strings[lang]);
  return typeof s === 'string' ? s.replace(/\{(\w+)\}/g, (m, k) => (k in vars ? vars[k] : m)) : key;
}

function setLang(next) {
  lang = next;
  document.documentElement.lang = lang === 'zh' ? 'zh-CN' : 'en';
  document.title = t('meta.title');
  toggle.textContent = t('meta.other_lang');
}

// Header toggle and footer links are hidden while a test is running.
function chrome(visible) {
  toggle.hidden = !visible;
  foot.hidden = !visible;
  foot.innerHTML = html`${location.pathname !== '/' ? html`<a href="/">${t('nav.home')}</a> · ` : ''}<a href="/stats">${t('nav.stats')}</a> · <a href="/class">${t('nav.teach')}</a>`;
}

const ctx = {
  app,
  t,
  get lang() { return lang; },
  get strings() { return strings[lang]; },
  get items() { return items; },
  setLang,
  chrome,
};

function renderLanding() {
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
  if (/^\/stats\/?$/.test(p)) return renderStats(ctx);
  if (/^\/class\/?$/.test(p)) return renderClassCreate(ctx);
  if (dash) return renderDashboard(ctx, dash[1]);
  return renderLanding();
}

async function boot() {
  const load = (path) => fetch(path).then((r) => (r.ok ? r.json() : Promise.reject(new Error(path))));
  try {
    const [en, zh, bank] = await Promise.all([load('/i18n/en.json'), load('/i18n/zh.json'), load('/items.json')]);
    strings = { en, zh };
    items = bank.items;
  } catch {
    app.innerHTML = html`<p class="msg">Couldn't load the test. Check your connection and reload. 加载失败，请检查网络后刷新。</p>`;
    return;
  }
  setLang(lang);
  toggle.onclick = () => { setLang(lang === 'en' ? 'zh' : 'en'); route(); };
  route();
}

boot();
