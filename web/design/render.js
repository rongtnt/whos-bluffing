// Renders the committed images and the review screenshots in headless Chrome over the DevTools protocol, and runs
// the layout checks. No dependencies (Node 22's fetch and WebSocket). CHROME=/path/to/chrome picks another Chromium.
//   node design/render.js assets           public/og.png, favicon-32.png, apple-touch-icon.png from design/*.html
//   node design/render.js screens [BASE]   design/screens/<page>-<width>-<theme>.png; BASE is a running `npm run dev`
//                                          (default http://127.0.0.1:8788); plays today's game for 4 local players
//   node design/render.js checks [BASE]    overflow at 375 px and layout shift on every page, keyboard walk on / and
//                                          /slack, theme toggle label and persistence
import { spawn } from 'node:child_process';
import { mkdtempSync, writeFileSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const WEB = fileURLToPath(new URL('../', import.meta.url));
const CHROME = process.env.CHROME ?? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const DEBUG_PORT = 9339;
const READY_TIMEOUT_MS = 6000;
const PAGES = ['/', '/slack', '/teachers', '/research', '/support', '/docs/api', '/privacy', '/terms', '/test', '/stats',
  '/class', '/tests/overconfidence-test', '/tests/estimation-test', '/tests/calibration-test', '/no-such-page'];
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function launch() {
  const profile = mkdtempSync(join(tmpdir(), 'howsure-render-'));
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

async function capture(cdp, file, width, height) {
  const h = height ?? await evaluate(cdp, 'Math.ceil(document.documentElement.scrollHeight)');
  const { data } = await cdp.send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: true, clip: { x: 0, y: 0, width, height: h, scale: 1 } });
  writeFileSync(file, Buffer.from(data, 'base64'));
  console.log(`wrote ${file.replace(WEB, 'web/')} (${width}x${h})`);
}

async function assets(cdp) {
  await cdp.send('Emulation.setDefaultBackgroundColorOverride', { color: { r: 0, g: 0, b: 0, a: 0 } }); // transparent icon corners
  const jobs = [['design/og.html', 'public/og.png', 1200, 630], ['design/icon.html', 'public/favicon-32.png', 32, 32],
    ['design/icon.html', 'public/apple-touch-icon.png', 180, 180, 'solid']];
  for (const [src, out, w, h, bodyClass] of jobs) {
    await open(cdp, `file://${WEB}${src}`, { width: w, height: h, mobile: false, waitReady: false });
    if (bodyClass) await evaluate(cdp, `document.body.classList.add('${bodyClass}')`);
    await capture(cdp, join(WEB, out), w, h);
  }
}

const post = (base, path, body) => fetch(`${base}${path}`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) })
  .then(async (r) => { if (!r.ok) throw new Error(`${path} -> ${r.status} ${await r.text()}`); return r.json(); });

// Plays today's game for anon through the API (pattern '11011' = hit, hit, miss, ...); returns the browser's local play.
async function playToday(base, anon, pattern) {
  const day = await fetch(`${base}/api/daily`).then((r) => r.json());
  const pool = new Map(JSON.parse(readFileSync(join(WEB, 'functions/_pool.json'), 'utf8')).items.map((i) => [i.id, i]));
  const answers = {};
  for (const [k, item] of day.items.entries()) {
    const truth = pool.get(item.id).answer;
    const w = Math.round(Math.abs(truth) * 0.25) + 1;
    const [low, high] = pattern[k] === '1' ? [truth - w, truth + w] : [truth + w, truth + 3 * w];
    const r = await post(base, '/api/daily/answer', { date: day.date, item_id: item.id, low, high, anon_id: anon, surface: 'web', rt_ms: 4000 });
    answers[item.id] = { low, high, hit: r.hit, truth: r.truth, source: r.source };
  }
  const done = await post(base, '/api/daily/complete', { date: day.date, anon_id: anon, surface: 'web' });
  return { date: day.date, play: { number: day.number, answers, result: { hits: done.hits, n: done.n, streak: done.streak, share_text: done.share_text } } };
}

async function screens(cdp, base) {
  const me = 'screenshotPlayerAAAAAA'; // 22 characters, like a browser's own hs_anon
  const mine = await playToday(base, me, '11011');
  for (const [i, pattern] of ['10110', '11111', '00100', '11010'].entries()) await playToday(base, `screenshotPlayer${i}BBBBB`, pattern);
  const shots = [['home', '/'], ['slack', '/slack'], ['research', '/research']];
  const sizes = [[375, 812], [768, 1024], [1280, 800]];
  const each = async (name, path) => {
    for (const dark of [false, true]) {
      for (const [w, h] of sizes) {
        await open(cdp, `${base}${path}`, { width: w, height: h, dark });
        await capture(cdp, join(WEB, `design/screens/${name}-${w}-${dark ? 'dark' : 'light'}.png`), w);
      }
    }
  };
  for (const [name, path] of shots) await each(name, path);
  // Results screen: this browser becomes the player who just finished today's game.
  await open(cdp, `${base}/support`, { width: 375 });
  await evaluate(cdp, `localStorage.setItem('hs_anon', ${JSON.stringify(JSON.stringify(me))});
    localStorage.setItem('hs_daily', ${JSON.stringify(JSON.stringify({ [mine.date]: mine.play }))}); true`);
  await each('results', '/');
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
  for (const path of ['/', '/slack']) {
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
  else throw new Error(`unknown mode ${mode} (assets | screens | checks)`);
} finally {
  cdp.close();
}
process.exit(failed ? 1 : 0);
