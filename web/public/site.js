// Site chrome for every page. A classic script loaded in <head> (not a module), so the stored theme applies before the
// first paint. Then: theme toggle, mobile menu, current-page link, Slack install links, list filters. No dependencies.

// The "Add to Slack" link: the Slack Worker's install URL (slack/README.md, step 8). Change it once the Worker is deployed.
const SLACK_INSTALL_URL = 'https://YOUR-WORKER-HOST/slack/oauth/start';

(() => {
  const root = document.documentElement;
  const THEME_KEY = 'whosbluffing_theme';
  const APP_REVEAL_MS = 4000; // app pages show their footer by then even if app.js never finishes its first render
  const prefersDark = matchMedia('(prefers-color-scheme: dark)');
  try {
    const saved = localStorage.getItem(THEME_KEY);
    if (saved === 'light' || saved === 'dark') root.dataset.theme = saved;
  } catch { /* storage blocked: follow the system theme */ }
  root.classList.add('js'); // styles.css hides below-the-game content until the page is .ready
  const isDark = () => (root.dataset.theme ? root.dataset.theme === 'dark' : prefersDark.matches);

  document.addEventListener('DOMContentLoaded', () => {
    if (document.getElementById('app')) setTimeout(() => root.classList.add('ready'), APP_REVEAL_MS);
    else root.classList.add('ready');

    const toggle = document.querySelector('[data-theme-toggle]');
    if (toggle) {
      const sync = () => toggle.setAttribute('aria-pressed', String(isDark()));
      sync();
      prefersDark.addEventListener('change', sync);
      toggle.addEventListener('click', () => {
        root.dataset.theme = isDark() ? 'light' : 'dark';
        try { localStorage.setItem(THEME_KEY, root.dataset.theme); } catch { /* not stored: lasts until the next page */ }
        sync();
      });
    }

    const menu = document.querySelector('.nav-menu');
    const links = document.getElementById('nav-links');
    if (menu && links) {
      const setOpen = (open) => {
        links.classList.toggle('open', open);
        menu.setAttribute('aria-expanded', String(open));
      };
      menu.addEventListener('click', () => {
        const open = !links.classList.contains('open');
        setOpen(open);
        if (open) links.querySelector('a').focus({ preventScroll: true });
      });
      document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && links.classList.contains('open')) { setOpen(false); menu.focus(); }
      });
    }

    const here = location.pathname.replace(/\/$/, '') || '/';
    for (const a of document.querySelectorAll('.nav-links a')) if (a.getAttribute('href') === here) a.setAttribute('aria-current', 'page');
    for (const a of document.querySelectorAll('[data-slack-install]')) a.href = SLACK_INSTALL_URL;

    // <input data-filter="ID">: hides rows of table#ID that don't contain the typed text; #ID-none shows when none match.
    for (const input of document.querySelectorAll('[data-filter]')) {
      const rows = [...document.querySelectorAll(`#${input.dataset.filter} tbody tr`)];
      const none = document.getElementById(`${input.dataset.filter}-none`);
      input.addEventListener('input', () => {
        const q = input.value.trim().toLowerCase();
        for (const r of rows) r.hidden = !r.textContent.toLowerCase().includes(q);
        if (none) none.hidden = rows.some((r) => !r.hidden);
      });
    }
  });
})();
