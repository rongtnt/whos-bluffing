// Renders the committed images and the review screenshots in headless Chrome over the DevTools protocol, and runs
// the layout checks. No dependencies (Node 22's fetch and WebSocket). CHROME=/path/to/chrome picks another Chromium.
//   node design/render.js assets           public/og.png, favicon-32.png, apple-touch-icon.png (from favicon.svg =
//                                          brand/icon.svg), press/logo.png and press/logo-dark.png from design/*.html
//   node design/render.js screens [BASE]   design/screens/<page>-<width>-<theme>.png for /, /slack, /research (375, 768,
//                                          1280) and /discord, /commands (375, 1280); BASE is a running `npm run dev`
//                                          (default http://127.0.0.1:8788)
//   node design/render.js checks [BASE]    overflow at 375 px and layout shift on every page, keyboard walk on /, /slack,
//                                          /discord and /commands, theme toggle label and persistence
//   node design/render.js rounds [BASE]    design/screens/rounds-{item,reveal-right,reveal-wrong,end,challenge}-<width>-
//                                          <theme>.png at 375 and 1280 px, motion on: plays today's ranked round in the
//                                          page (the first answer right at 100%, the second wrong at 100%) after four API
//                                          players for the leaderboard, and opens a challenge link from a fifth
//   node design/render.js results [BASE]   design/screens/results-<width>-<theme>.png at 375, 768 and 1280 px: the full
//                                          assessment (/test) played through to its results page, whole page
import { spawn } from 'node:child_process';
import { mkdtempSync, writeFileSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const WEB = fileURLToPath(new URL('../', import.meta.url));
const CHROME = process.env.CHROME ?? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const DEBUG_PORT = 9339;
const READY_TIMEOUT_MS = 6000;
const PAGES = ['/', '/discord', '/slack', '/commands', '/teachers', '/research', '/support', '/community', '/status', '/press',
  '/changelog', '/docs/api', '/privacy', '/terms', '/test', '/stats', '/class', '/tests/overconfidence-test',
  '/tests/estimation-test', '/tests/calibration-test', '/no-such-page'];
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const HERO_SHOTS = ['home', 'discord']; // also captured as one 1280x800 screen for /press

async function launch() {
  const profile = mkdtempSync(join(tmpdir(), 'whosbluffing-render-'));
  const chrome = spawn(CHROME, ['--headless=new', `--remote-debugging-port=${DEBUG_PORT}`, `--user-data-dir=${profile}`,
    '--no-first-run', '--no-default-browser-check', '--hide-scrollbars', '--force-color-profile=srgb', 'about:blank'], { stdio: 'ignore' });
  chrome.on('exit', () => rmSync(profile, { recursive: true, force: true }));
  let up = false;
  for (let i = 0; i < 100 && !up; i += 1) {
    up = await fetch(`http://127.0.0.1:${DEBUG_PORT}/json/version`).then((r) => r.ok).catch(() => false);
    if (!up) await sleep(100);
  }
  if (!up) throw new Error(`Chrome did not start: ${CHROME}`);
  const target = await fetch(`http://127.0.0.1:${DEBUG_PORT}/json/new?about:blank`, { method: 'PUT' }).then((r) => r.json());
  const ws = new WebSocket(target.webSocketDebuggerUrl);
  await new Promise((resolve, reject) => { ws.onopen = resolve; ws.onerror = reject; });
  let seq = 0;
  const waiting = new Map();
  const listeners = new Set();
  ws.onmessage = ({ data }) => {
    const msg = JSON.parse(data);
    const w = waiting.get(msg.id);
    if (w) { waiting.delete(msg.id); if (msg.error) w.reject(new Error(`${msg.error.message} (${w.method})`)); else w.resolve(msg.result); return; }
    for (const f of listeners) f(msg);
  };
  const send = (method, params = {}) => new Promise((resolve, reject) => {
    seq += 1;
    waiting.set(seq, { resolve, reject, method });
    ws.send(JSON.stringify({ id: seq, method, params }));
  });
  const next = (method) => new Promise((resolve) => {
    const f = (m) => { if (m.method === method) { listeners.delete(f); resolve(m.params); } };
    listeners.add(f);
  });
  await send('Page.enable');
  await send('Emulation.setFocusEmulationEnabled', { enabled: true });
  return { send, next, close: () => { ws.close(); chrome.kill(); } };
}

async function evaluate(cdp, expression) {
  const r = await cdp.send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true });
  if (r.exceptionDetails) throw new Error(`${r.exceptionDetails.text} in: ${expression.slice(0, 80)}`);
  return r.result.value;
}

// Opens url at the given size and theme; waits for the app's first render (html.ready) unless waitReady is false.
async function open(cdp, url, { width, height = 900, dark = false, mobile = width < 768, motion = 'reduce', waitReady = true }) {
  await cdp.send('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: 1, mobile });
  await cdp.send('Emulation.setEmulatedMedia', { features: [
    { name: 'prefers-color-scheme', value: dark ? 'dark' : 'light' }, { name: 'prefers-reduced-motion', value: motion }] });
  const loaded = cdp.next('Page.loadEventFired');
  await cdp.send('Page.navigate', { url });
  await loaded;
  if (waitReady) {
    await evaluate(cdp, `new Promise((done) => { const t0 = Date.now(); (function wait() {
      if (document.documentElement.classList.contains('ready') || Date.now() - t0 > ${READY_TIMEOUT_MS}) done(); else setTimeout(wait, 50); })(); })`);
  }
  await sleep(400);
}

async function capture(cdp, file, width, height, y = 0) {
  const h = height ?? await evaluate(cdp, 'Math.ceil(document.documentElement.scrollHeight)');
  const { data } = await cdp.send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: true, clip: { x: 0, y, width, height: h, scale: 1 } });
  writeFileSync(file, Buffer.from(data, 'base64'));
  console.log(`wrote ${file.replace(WEB, 'web/')} (${width}x${h})`);
}

async function assets(cdp) {
  await cdp.send('Emulation.setDefaultBackgroundColorOverride', { color: { r: 0, g: 0, b: 0, a: 0 } }); // transparent icon corners
  const jobs = [['design/og.html', 'public/og.png', 1200, 630], ['design/icon.html', 'public/favicon-32.png', 32, 32],
    ['design/icon.html', 'public/apple-touch-icon.png', 180, 180, 'solid'],
    ['design/logo.html', 'public/press/logo.png', 1280, 320], ['design/logo.html', 'public/press/logo-dark.png', 1280, 320, 'dark']];
  for (const [src, out, w, h, bodyClass] of jobs) {
    await open(cdp, `file://${WEB}${src}`, { width: w, height: h, mobile: false, waitReady: false });
    if (bodyClass) await evaluate(cdp, `document.body.classList.add('${bodyClass}')`);
    await capture(cdp, join(WEB, out), w, h);
  }
}

const post = (base, path, body) => fetch(`${base}${path}`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) })
  .then(async (r) => { if (!r.ok) throw new Error(`${path} -> ${r.status} ${await r.text()}`); return r.json(); });

async function screens(cdp, base) {
  const all = [[375, 812], [768, 1024], [1280, 800]];
  const shots = [['home', '/', all], ['slack', '/slack', all], ['research', '/research', all],
    ['discord', '/discord', [all[0], all[2]]], ['commands', '/commands', [all[0], all[2]]]];
  for (const [name, path, sizes] of shots) {
    for (const dark of [false, true]) {
      for (const [w, h] of sizes) {
        await open(cdp, `${base}${path}`, { width: w, height: h, dark });
        await capture(cdp, join(WEB, `design/screens/${name}-${w}-${dark ? 'dark' : 'light'}.png`), w);
        if (HERO_SHOTS.includes(name) && w === 1280 && !dark) await capture(cdp, join(WEB, `design/screens/${name}-hero-1280-light.png`), w, h); // the press kit's view
      }
    }
  }
}

// Plays a round through the API: pattern of 1 (right) / 0 per pair, confidences cycled; returns complete's body.
async function playRoundApi(base, round, anon, pattern, confs, extra = {}) {
  const truth = new Map(JSON.parse(readFileSync(join(WEB, 'functions/_pairs.json'), 'utf8')).pairs.map(([n, , , t]) => [`p${String(n).padStart(5, '0')}`, t]));
  for (const [k, item] of round.items.entries()) {
    const right = pattern[k % pattern.length] === '1';
    await post(base, '/api/round/answer', { round_id: round.round_id, item_id: item.id, choice: right ? truth.get(item.id) : 1 - truth.get(item.id),
      conf: confs[k % confs.length], rt_ms: 4000, anon_id: anon, surface: 'web' });
  }
  return post(base, '/api/round/complete', { round_id: round.round_id, anon_id: anon, surface: 'web', ...extra });
}

// An expression that waits (in the page) for an enabled element matching sel.
const waitFor = (sel) => `await new Promise((done, fail) => { const t0 = Date.now(); (function poll() {
  const el = document.querySelector(${JSON.stringify(sel)}); if (el && !el.disabled) done(el);
  else if (Date.now() - t0 > 8000) fail(new Error('timeout: ' + ${JSON.stringify(sel)})); else setTimeout(poll, 40); })(); })`;

// The truth (0 = A, 1 = B) of every pair, from the synced compact pairs.
const truthOf = () => new Map(JSON.parse(readFileSync(join(WEB, 'functions/_pairs.json'), 'utf8')).pairs.map(([n, , , t]) => [`p${String(n).padStart(5, '0')}`, t]));

// In the page: answers the question on screen (right or wrong, at conf), using the saved round to know which pair it is.
const answerInPage = (truth, right, conf) => `(async () => { ${waitFor('button.pick')};
  const st = JSON.parse(localStorage.getItem('whosbluffing_round')); const k = st.items.findIndex((i) => !st.answers[i.id]);
  const t = ${JSON.stringify(Object.fromEntries(truth))}[st.items[k].id]; const pick = ${right} ? t : 1 - t;
  document.querySelectorAll('button.pick')[pick].click(); (${waitFor(`#conf:not([hidden]) [data-conf="${conf}"]`)}).click();
  ${waitFor('.reveal')}; return true; })()`;

async function roundScreens(cdp, base) {
  const get = (path) => fetch(`${base}${path}`).then((r) => r.json());
  const ranked = await get('/api/round?mode=ranked');
  const all = truthOf();
  const truth = new Map(ranked.items.map((i) => [i.id, all.get(i.id)])); // today's ten
  const players = [['1111111110', [90]], ['1101101101', [80, 70]], ['1010101010', [100, 60]], ['1111110000', [70]]];
  for (const [i, [pattern, confs]] of players.entries()) await playRoundApi(base, ranked, `shotRanked${i}`.padEnd(22, 'x'), pattern, confs);
  const host = await playRoundApi(base, await get('/api/round?mode=quick'), 'shotHostSam'.padEnd(22, 'x'), '1110111011', [90, 80, 70], { nickname: 'Sam' });
  const challenge = new URL(host.challenge_url).pathname;
  for (const dark of [false, true]) {
    for (const [w, h] of [[375, 812], [1280, 800]]) {
      const theme = dark ? 'dark' : 'light';
      const file = (name) => join(WEB, `design/screens/rounds-${name}-${w}-${theme}.png`);
      await open(cdp, `${base}/support`, { width: w, height: h, dark }); // a fresh player in this browser
      await evaluate(cdp, `localStorage.clear(); localStorage.setItem('whosbluffing_anon', ${JSON.stringify(JSON.stringify(`shot${theme}${w}`.padEnd(22, 'y')))}); localStorage.setItem('whosbluffing_sound', 'off'); true`);
      await open(cdp, `${base}/`, { width: w, height: h, dark, motion: 'no-preference' });
      await evaluate(cdp, `(async () => { document.getElementById('play').click(); (${waitFor('button.pick')}).click(); ${waitFor('#conf:not([hidden]) [data-conf="80"]')}; return true; })()`);
      await sleep(300);
      await capture(cdp, file('item'), w, h);
      await evaluate(cdp, answerInPage(truth, true, 100)); // right at 100%: confetti, the gold stamp
      await sleep(1300);
      await capture(cdp, file('reveal-right'), w, h);
      await evaluate(cdp, `(async () => { (${waitFor('#next')}).click(); return true; })()`);
      await evaluate(cdp, answerInPage(truth, false, 100)); // wrong at 100%: shake, red flash, the biggest BLUFF stamp
      await sleep(1300);
      await capture(cdp, file('reveal-wrong'), w, h);
      await evaluate(cdp, `(async () => { for (let k = 2; k < 10; k += 1) { (${waitFor('#next')}).click(); ${waitFor('button.pick')};
        document.querySelectorAll('button.pick')[k % 2].click(); (${waitFor('[data-conf="70"]')}).click(); ${waitFor('.reveal')}; }
        (${waitFor('#next')}).click(); ${waitFor('.result-title')}; return true; })()`);
      await sleep(2200); // squares, the type card's flip, the counters and the ranked leaderboard
      const box = await evaluate(cdp, `(() => { window.scrollTo(0, 0); const r = document.getElementById('app').getBoundingClientRect();
        return { y: Math.max(0, Math.round(r.top - 72)), h: Math.round(r.height + 96) }; })()`);
      await capture(cdp, file('end'), w, box.h, box.y); // the result, from the nav's height above it
      await open(cdp, `${base}${challenge}`, { width: w, height: h, dark });
      await capture(cdp, file('challenge'), w, h);
    }
  }
}

// The full assessment at /test, answered through the page (two-choice: the first option at 80%; ranges: 10 to 1000,
// sent again after a warning; no demographics), then its results page, whole.
async function resultScreens(cdp, base) {
  const play = `(async () => { document.getElementById('start').click();
    for (let n = 0; n < 60; n += 1) {
      await new Promise((r) => setTimeout(r, 60));
      if (document.querySelector('#app h1') && document.querySelector('.headline')) return true;
      const opt = document.querySelector('.opt');
      if (opt) { opt.click(); (${waitFor('#conf:not([hidden]) [data-c="80"]')}).click(); continue; }
      const range = document.querySelector('form.range');
      if (range) { range.low.value = '10'; range.high.value = '1000'; range.requestSubmit(); await new Promise((r) => setTimeout(r, 60));
        if (document.querySelector('form.range') === range && range.querySelector('.msg').textContent) range.requestSubmit(); continue; }
      const skip = document.querySelector('form.demo .skip');
      if (skip) skip.click();
    }
    throw new Error('the assessment did not reach its results'); })()`;
  for (const dark of [false, true]) {
    for (const [w, h] of [[375, 812], [768, 1024], [1280, 800]]) {
      await open(cdp, `${base}/support`, { width: w, height: h, dark });
      await evaluate(cdp, 'localStorage.clear(); true');
      await open(cdp, `${base}/test`, { width: w, height: h, dark });
      await evaluate(cdp, play);
      await sleep(600);
      await evaluate(cdp, 'window.scrollTo(0, 0)');
      await capture(cdp, join(WEB, `design/screens/results-${w}-${dark ? 'dark' : 'light'}.png`), w);
    }
  }
}

const PRESS_TAB = [{ type: 'keyDown', key: 'Tab', code: 'Tab', windowsVirtualKeyCode: 9 }, { type: 'keyUp', key: 'Tab', code: 'Tab', windowsVirtualKeyCode: 9 }];

// Tabs through the page; returns {controls, reached, missing, noRing}. Controls = visible, enabled, tabbable elements.
async function keyboardWalk(cdp) {
  const controls = await evaluate(cdp, `(() => {
    const els = [...document.querySelectorAll('a[href], button, input, select, textarea, summary, [tabindex]')]
      .filter((el) => !el.disabled && el.tabIndex >= 0 && el.getClientRects().length && getComputedStyle(el).visibility !== 'hidden'
        && !el.closest('[aria-hidden="true"], details:not([open]) > :not(summary)'));
    els.forEach((el, i) => { el.dataset.walk = i; });
    return els.length; })()`);
  const reached = new Set();
  const noRing = [];
  for (let i = 0; i < controls + 10; i += 1) {
    for (const e of PRESS_TAB) await cdp.send('Input.dispatchKeyEvent', e);
    const f = await evaluate(cdp, `(() => { const el = document.activeElement; if (!el || el === document.body) return null;
      const s = getComputedStyle(el); const ring = (s.outlineStyle !== 'none' && parseFloat(s.outlineWidth) >= 2) || s.boxShadow !== 'none';
      return { id: el.dataset.walk ?? null, ring, label: (el.getAttribute('aria-label') || el.textContent).trim().replace(/\\s+/g, ' ').slice(0, 40) }; })()`);
    if (!f || f.id === null) continue;
    if (reached.has(f.id)) break; // wrapped around
    reached.add(f.id);
    if (!f.ring) noRing.push(f.label);
  }
  const missing = await evaluate(cdp, `[...document.querySelectorAll('[data-walk]')].filter((el) => !${JSON.stringify([...reached])}.includes(el.dataset.walk))
    .map((el) => (el.getAttribute('aria-label') || el.textContent).trim().replace(/\\s+/g, ' ').slice(0, 40))`);
  return { controls, reached: reached.size, missing, noRing };
}

async function checks(cdp, base) {
  let problems = 0;
  const flag = (ok, line) => { if (!ok) problems += 1; console.log(`${ok ? 'ok  ' : 'FAIL'} ${line}`); };
  for (const path of PAGES) {
    for (const width of [375, 1280]) {
      await open(cdp, `${base}${path}`, { width, motion: 'no-preference' });
      await sleep(800);
      const r = await evaluate(cdp, `new Promise((done) => { let cls = 0;
        new PerformanceObserver((list) => { for (const e of list.getEntries()) if (!e.hadRecentInput) cls += e.value; }).observe({ type: 'layout-shift', buffered: true });
        setTimeout(() => done({ cls: Math.round(cls * 10000) / 10000, overflow: document.documentElement.scrollWidth - innerWidth }), 300); })`);
      flag(r.cls === 0 && r.overflow <= 0, `${path} at ${width}px: layout shift ${r.cls}, horizontal overflow ${r.overflow}px`);
    }
  }
  for (const path of ['/', '/slack', '/discord', '/commands']) {
    for (const width of [1280, 375]) {
      await open(cdp, `${base}${path}`, { width });
      const w = await keyboardWalk(cdp);
      flag(w.reached === w.controls && !w.noRing.length,
        `keyboard ${path} at ${width}px: ${w.reached}/${w.controls} controls reached with Tab, ${w.noRing.length} without a visible ring`
        + (w.missing.length ? `; not reached: ${w.missing.join(' | ')}` : '') + (w.noRing.length ? `; no ring: ${w.noRing.join(' | ')}` : ''));
    }
  }
  await open(cdp, `${base}/slack`, { width: 1280 });
  const before = await evaluate(cdp, `(() => { const b = document.querySelector('[data-theme-toggle]'); b.click();
    return { label: b.getAttribute('aria-label'), pressed: b.getAttribute('aria-pressed') }; })()`);
  await open(cdp, `${base}/research`, { width: 1280 });
  const after = await evaluate(cdp, `({ theme: document.documentElement.dataset.theme, pressed: document.querySelector('[data-theme-toggle]').getAttribute('aria-pressed'),
    bg: getComputedStyle(document.body).backgroundColor })`);
  flag(before.label && after.theme === 'dark' && after.pressed === 'true',
    `theme toggle: aria-label "${before.label}", after a click and a new page: data-theme=${after.theme}, aria-pressed=${after.pressed}, body ${after.bg}`);
  console.log(problems ? `\n${problems} check(s) failed` : '\nall checks pass');
  return problems;
}

const [mode = 'assets', base = 'http://127.0.0.1:8788'] = process.argv.slice(2);
const cdp = await launch();
let failed = 0;
try {
  if (mode === 'assets') await assets(cdp);
  else if (mode === 'screens') await screens(cdp, base);
  else if (mode === 'checks') failed = await checks(cdp, base);
  else if (mode === 'rounds') await roundScreens(cdp, base);
  else if (mode === 'results') await resultScreens(cdp, base);
  else throw new Error(`unknown mode ${mode} (assets | screens | checks | rounds | results)`);
} finally {
  cdp.close();
}
process.exit(failed ? 1 : 0);
