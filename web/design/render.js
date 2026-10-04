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
//   node design/render.js demo [BASE] [square|poster|vertical]
//                                          public/press/demo.mp4 (1080x1080), demo.gif (640 px, loops), demo-poster.png
//                                          (1200x675), demo-vertical.mp4 (1080x1920) and demo-vertical-poster.png (or one
//                                          part): today's ranked round played in the page with motion on, shot with
//                                          Page.captureScreenshot and cut with ffmpeg (FFMPEG=/path/to/ffmpeg picks another)
import { spawn, spawnSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, rmSync, copyFileSync, existsSync } from 'node:fs';
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
async function open(cdp, url, { width, height = 900, scale = 1, dark = false, mobile = width < 768, motion = 'reduce', waitReady = true }) {
  await cdp.send('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: scale, mobile });
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

// --- the press demo (mode demo) -------------------------------------------------------------------------------------

const FFMPEG = process.env.FFMPEG ?? 'ffmpeg';
const PRESS = join(WEB, 'public/press');
const FPS = 30;
const MAX_SHOT_S = 0.2; // a longer gap between two shots is not shown as a freeze
const START_HOLD_S = 0.6;
const LOCKUP_S = 1.5;
const END_HOLD_S = 1.5;
const GIF_S = 12;
const INTRO_S = 5; // demo-vertical: intro clip, round, end card
const ROUND_S = 17;
const END_CARD_S = 3;
// Ten answers per take, [right, conf]; a take shows the leading ones and plays the rest off camera. Both takes end
// Hot-headed (7 of 10 right at 81 to 82% sure), the 100% miss giving the roast line.
const SQUARE_PLAN = [[1, 80], [0, 100], [1, 90], [1, 80], [0, 70], [1, 80], [1, 80], [0, 80], [1, 80], [1, 80]];
const VERTICAL_PLAN = [[0, 100], [1, 80], [0, 70], [1, 80], [1, 80], [0, 80], [1, 80], [1, 80], [1, 80], [1, 80]];
// demo-vertical follows posts/video-script.md: captions in the top third, the game below them (the nav hidden, the
// round pushed down), so a caption never covers it.
const VERTICAL_TOP = 140; // CSS px above the round
const CAPTION_Y = 250; // px, the captions' centre in the 1080x1920 frame
// Chrome's JPEG shots are full-range BT.601; the videos are limited-range BT.709, tagged so.
const TO_709 = 'scale=out_color_matrix=bt709:out_range=tv,setsar=1,format=yuv420p';
const TAGS_709 = ['-colorspace', 'bt709', '-color_primaries', 'bt709', '-color_trc', 'bt709', '-color_range', 'tv'];

function ffmpeg(...args) {
  const r = spawnSync(FFMPEG, ['-y', '-loglevel', 'error', ...args], { stdio: 'inherit' });
  if (r.status !== 0) throw new Error(`ffmpeg exited with ${r.status}: ${args.join(' ')}`);
}

// JPEG shots of the viewport every 1/FPS s (or as fast as Chrome returns them) while on. Frames are { file, t }, t in
// ms on a clock that stops while paused, so a pause leaves no gap.
function recorder(cdp, dir) {
  const frames = [];
  let on = false, done = false, clock = 0, since = 0, busy = Promise.resolve();
  const now = () => clock + (on ? Date.now() - since : 0);
  const loop = (async () => {
    while (!done) {
      if (!on) { await sleep(5); continue; }
      const t0 = Date.now();
      const asked = now();
      busy = cdp.send('Page.captureScreenshot', { format: 'jpeg', quality: 92, optimizeForSpeed: true });
      const { data } = await busy;
      const t = (asked + now()) / 2; // a shot takes ~50 ms; it shows the page somewhere inside that
      const file = join(dir, `f${String(frames.length).padStart(5, '0')}.jpg`);
      writeFileSync(file, Buffer.from(data, 'base64'));
      frames.push({ file, t });
      await sleep(Math.max(0, 1000 / FPS - (Date.now() - t0)));
    }
  })();
  return {
    frames, now,
    start() { since = Date.now(); on = true; },
    async pause() { clock = now(); on = false; await busy; },
    async stop() { await this.pause(); done = true; await loop; },
  };
}

// An ffmpeg concat list: each shot lasts until the next one (at most MAX_SHOT_S), the opening one `lead` s longer, then
// the stills of `tail` ([file, s] each). The last entry is repeated: concat ignores the duration of the last one.
function concatList(path, frames, lead = 0, tail = []) {
  const shots = [...frames.map((f, i) => [f.file, (i ? 0 : lead)
    + (i + 1 < frames.length ? Math.min(MAX_SHOT_S, (frames[i + 1].t - f.t) / 1000) : 1 / FPS)]), ...tail];
  writeFileSync(path, [...shots.flatMap(([file, s]) => [`file '${file}'`, `duration ${s.toFixed(4)}`]), `file '${shots.at(-1)[0]}'`].join('\n'));
  return shots.reduce((sum, [, s]) => sum + s, 0);
}

// In the page: taps the right (or wrong) option of the question on screen, then waits for the confidence picker.
const pickInPage = (truth, right) => `(async () => { ${waitFor('button.pick')};
  const st = JSON.parse(localStorage.getItem('whosbluffing_round')); const k = st.items.findIndex((i) => !st.answers[i.id]);
  const t = ${JSON.stringify(Object.fromEntries(truth))}[st.items[k].id];
  document.querySelectorAll('button.pick')[${right ? 't' : '1 - t'}].click(); ${waitFor('#conf:not([hidden]) [data-conf="50"]')}; return true; })()`;
// In the page: stakes conf (the button shown pressed for a beat, as under a finger), then waits for the reveal.
const stakeInPage = (conf) => `(async () => { const b = ${waitFor(`#conf:not([hidden]) [data-conf="${conf}"]`)};
  b.setAttribute('aria-pressed', 'true'); await new Promise((r) => setTimeout(r, 300)); b.click(); ${waitFor('.reveal')}; return true; })()`;
const nextInPage = `(async () => { (${waitFor('#next')}).click(); ${waitFor('button.pick')}; return true; })()`;

// A fresh player in this browser (sound off).
async function freshPlayer(cdp, base, view) {
  await open(cdp, `${base}/support`, view);
  await evaluate(cdp, `localStorage.clear(); localStorage.setItem('whosbluffing_anon', ${JSON.stringify(JSON.stringify(`demo${Date.now().toString(36)}`.padEnd(22, 'p')))});
    localStorage.setItem('whosbluffing_sound', 'off'); true`);
}

// One take of today's ranked round, played by clicks at width x height CSS px times scale, motion on: the home page
// for `home` ms (if set), then the answers of `plan`, those with a hold on camera (read ms on the question, think ms
// on the open picker, the hold on the reveal), the rest paused; then the end screen for endHold ms. Returns
// { frames, marks }, marks in ms on the recorder's clock.
async function demoTake(cdp, base, truth, dir, { width, height, scale, home = 0, prep, read, think, holds, plan, endHold }) {
  mkdirSync(dir, { recursive: true });
  await freshPlayer(cdp, base, { width, height, scale });
  await open(cdp, `${base}/`, { width, height, scale, motion: 'no-preference' });
  if (prep) await evaluate(cdp, prep);
  const rec = recorder(cdp, dir);
  const marks = {};
  const mark = (name, t = rec.now()) => { marks[name] = t; console.log(`  ${(t / 1000).toFixed(2)} s  ${name}`); };
  if (home) { rec.start(); mark('home'); await sleep(home); }
  await evaluate(cdp, `(async () => { document.getElementById('play').click(); ${waitFor('button.pick')}; return true; })()`);
  if (!home) rec.start();
  for (const [k, [right, conf]] of plan.entries()) {
    if (k) await evaluate(cdp, nextInPage);
    if (k >= holds.length) { await evaluate(cdp, pickInPage(truth, right)); await evaluate(cdp, stakeInPage(conf)); continue; }
    mark(`q${k + 1}`); await sleep(read);
    await evaluate(cdp, pickInPage(truth, right)); mark(`q${k + 1} pick`); await sleep(think);
    await evaluate(cdp, stakeInPage(conf)); mark(`q${k + 1} reveal`); await sleep(holds[k]);
    if (k + 1 === holds.length) { mark('cut'); await rec.pause(); }
  }
  await evaluate(cdp, `(async () => { (${waitFor('#next')}).click(); ${waitFor('.result-title')};
    document.getElementById('app').scrollIntoView({ behavior: 'instant' }); return true; })()`);
  rec.start();
  const n = rec.frames.length;
  while (rec.frames.length === n) await sleep(5);
  mark('end', rec.frames[n].t); // the end screen's opening shot: the cut
  await sleep(endHold);
  await rec.stop();
  console.log(`  ${rec.frames.length} shots in ${(rec.now() / 1000).toFixed(1)} s (${(rec.frames.length / rec.now() * 1000).toFixed(1)} per s)`);
  return { frames: rec.frames, marks };
}

// A still from an HTML string, width x height at 1x; transparent where the page is.
async function still(cdp, file, html, width, height) {
  const page = `${file}.html`;
  writeFileSync(page, html);
  await cdp.send('Emulation.setDefaultBackgroundColorOverride', { color: { r: 0, g: 0, b: 0, a: 0 } });
  await open(cdp, `file://${page}`, { width, height, mobile: false, waitReady: false });
  await capture(cdp, file, width, height);
  await cdp.send('Emulation.setDefaultBackgroundColorOverride', {});
}

const cardPage = (css, body) => `<!doctype html><html lang="en" data-theme="light"><head><meta charset="utf-8">
<link rel="stylesheet" href="file://${WEB}public/styles.css"><style>html, body { width: 1080px; height: 1920px; margin: 0; } ${css}</style></head>
<body>${body}</body></html>`;
// A caption: white 800-weight type on a soft dark band, centred at y px of a 1080x1920 frame.
const captionPage = (text) => cardPage(`html, body { background: transparent !important; }
p { position: absolute; left: 50%; top: ${CAPTION_Y}px; transform: translate(-50%, -50%); margin: 0; padding: 24px 42px; border-radius: 32px;
  white-space: nowrap; background: rgba(14, 17, 22, 0.7); box-shadow: 0 0 56px 18px rgba(14, 17, 22, 0.3);
  color: #fff; font: 800 60px/1.15 var(--font); letter-spacing: -0.02em; }`, `<p>${text}</p>`);
const endCardPage = cardPage(`body { display: flex; flex-direction: column; align-items: center; justify-content: center; background: var(--bg); }
img { width: 1040px; height: auto; margin-bottom: 40px; } p { margin: 0; font: 800 72px/1.2 var(--font); letter-spacing: -0.02em; color: var(--text); }
p + p { margin-top: 20px; font: 800 60px/1.2 var(--font); color: var(--accent); }`,
`<img src="file://${PRESS}/logo.png" alt=""><p>Your turn. Prove it.</p><p>whosbluffing.com</p>`);

// demo.mp4: a 600 px square page at 1.8x (1080x1080): the home page, three answers, the end screen, then og.png as the
// lockup card. demo.gif: question 1 to the end of the question 2 reveal (at most GIF_S), 640 px.
async function squareDemo(cdp, base, truth, dir) {
  console.log('square take');
  const take = await demoTake(cdp, base, truth, join(dir, 'square'), { width: 600, height: 600, scale: 1.8, home: 1500,
    read: 1300, think: 1100, holds: [2600, 3200, 2200], plan: SQUARE_PLAN, endHold: 4000 });
  const card = join(dir, 'lockup.jpg');
  ffmpeg('-i', join(WEB, 'public/og.png'), '-vf', 'scale=1080:-1:flags=lanczos,pad=1080:1080:0:(oh-ih)/2:color=#FBFAF7,format=yuvj420p', '-q:v', '1', card);
  const list = join(dir, 'square.txt');
  const total = concatList(list, take.frames, START_HOLD_S, [[card, LOCKUP_S + END_HOLD_S]]);
  const mp4 = join(dir, 'demo.mp4');
  ffmpeg('-f', 'concat', '-safe', '0', '-i', list, '-vf', `fps=${FPS},${TO_709}`, '-t', total.toFixed(3), // -t: fps would stretch the repeated still
    '-c:v', 'libx264', '-preset', 'slow', '-crf', '20', ...TAGS_709, '-movflags', '+faststart', '-an', mp4);
  const at = (name) => START_HOLD_S + (take.marks[name] - take.frames[0].t) / 1000; // in the mp4
  const to = at('q3');
  const from = Math.max(at('q1'), to - GIF_S);
  ffmpeg('-ss', from.toFixed(3), '-t', (to - from).toFixed(3), '-i', mp4, '-vf',
    'fps=15,scale=640:-1:flags=lanczos,split[a][b];[a]palettegen=stats_mode=diff[p];[b][p]paletteuse=dither=bayer:bayer_scale=5:diff_mode=rectangle',
    '-loop', '0', join(dir, 'demo.gif'));
}

// demo-poster.png (1200x675): question 1 with an option picked and the confidence picker open; the nav keeps only the
// lockup.
async function demoPoster(cdp, base, dir) {
  console.log('poster');
  await freshPlayer(cdp, base, { width: 1200, height: 675 });
  await open(cdp, `${base}/`, { width: 1200, height: 675 });
  await evaluate(cdp, `(async () => { document.getElementById('play').click(); ${waitFor('button.pick')};
    document.querySelectorAll('button.pick')[1].click(); ${waitFor('#conf:not([hidden]) [data-conf="80"]')};
    for (const el of document.querySelectorAll('.nav-links, .nav-bar .icon-btn')) el.style.display = 'none';
    const css = (sel, props) => Object.assign(document.querySelector(sel).style, props);
    css('html', { scrollbarGutter: 'auto' });
    css('.nav', { borderBottom: '0', background: 'transparent', backdropFilter: 'none' });
    css('.nav-bar', { maxWidth: 'none', minHeight: '96px', padding: '0 44px' });
    css('.nav .brand', { fontSize: '32px', gap: '12px' });
    css('#app', { zoom: '1.32', paddingTop: '0' });
    return true; })()`);
  await capture(cdp, join(dir, 'demo-poster.png'), 1200, 675);
}

// demo-vertical.mp4 (1080x1920), timed and worded by posts/video-script.md: the intro clip under two captions
// (INTRO_S), a 375 px page at 2.88 answering question 1 wrong at 100% then the end screen, under five captions
// (ROUND_S), and the end card: the lockup, the last line and the address (END_CARD_S). Captions change on the beat
// (the tap, the stake, the cut). demo-vertical-poster.png: the intro's closing frame under its second caption.
async function verticalDemo(cdp, base, truth, dir) {
  console.log('vertical take');
  const prep = `(() => { document.querySelector('.nav').style.display = 'none';
    Object.assign(document.getElementById('app').style, { paddingTop: '${VERTICAL_TOP}px', scrollMarginTop: '0' }); return true; })()`;
  const take = await demoTake(cdp, base, truth, join(dir, 'vertical'), { width: 375, height: 667, scale: 2.88, prep,
    read: 3000, think: 2680, holds: [6000], plan: VERTICAL_PLAN, endHold: 5600 });
  const at = (name) => INTRO_S + (take.marks[name] - take.frames[0].t) / 1000; // in the cut
  const captions = [['Think you know things?', 0, 2.5], ['Let’s see who’s bluffing.', 2.5, INTRO_S],
    ['Easy question. Pick one.', INTRO_S, at('q1 pick')], ['How sure? 100%, obviously.', at('q1 pick'), at('q1 reveal')],
    ['100% sure. 100% wrong.', at('q1 reveal'), at('q1 reveal') + 3], ['That’s minus 300 points.', at('q1 reveal') + 3, at('end')],
    ['And yes, it roasts you.', at('end'), INTRO_S + ROUND_S]];
  const files = [];
  for (const [i, [text]] of captions.entries()) {
    files.push(join(dir, `caption${i}.png`));
    await still(cdp, files[i], captionPage(text), 1080, 1920);
  }
  const card = join(dir, 'end-card.png');
  await still(cdp, card, endCardPage, 1080, 1920);
  const list = join(dir, 'vertical.txt');
  const shot = concatList(list, take.frames);
  if (shot < ROUND_S) throw new Error(`the vertical take is ${shot.toFixed(2)} s, shorter than ${ROUND_S} s`);
  const intro = join(PRESS, 'intro-cards-raw.mp4');
  const graph = [`[0:v]trim=duration=${INTRO_S},setpts=PTS-STARTPTS,fps=${FPS},scale=1080:1920:flags=lanczos:in_color_matrix=bt709:in_range=tv:out_color_matrix=bt709:out_range=tv,setsar=1,format=yuv420p[intro]`,
    `[1:v]fps=${FPS},crop=1080:1920:0:0,${TO_709},trim=duration=${ROUND_S},setpts=PTS-STARTPTS[round]`, `[2:v]fps=${FPS},${TO_709},trim=duration=${END_CARD_S}[end]`,
    '[intro][round][end]concat=n=3:v=1:a=0[v0]',
    ...captions.map(([, from, to], i) => `[v${i}][${i + 3}:v]overlay=0:0:enable='gte(t,${from.toFixed(3)})*lt(t,${to.toFixed(3)})'[v${i + 1}]`)];
  ffmpeg('-i', intro, '-f', 'concat', '-safe', '0', '-i', list, '-loop', '1', '-t', String(END_CARD_S), '-i', card,
    ...files.flatMap((f) => ['-i', f]), '-filter_complex', graph.join(';'), '-map', `[v${captions.length}]`, '-an',
    '-c:v', 'libx264', '-preset', 'slow', '-crf', '21', ...TAGS_709, '-movflags', '+faststart', join(dir, 'demo-vertical.mp4'));
  ffmpeg('-ss', String(INTRO_S - 0.08), '-i', intro, '-i', files[1], '-filter_complex',
    '[0:v]scale=1080:1920:flags=lanczos:in_color_matrix=bt709:in_range=tv,format=rgb24[b];[b][1:v]overlay=0:0:format=rgb',
    '-frames:v', '1', join(dir, 'demo-vertical-poster.png'));
}

async function demo(cdp, base, only) {
  const ranked = await fetch(`${base}/api/round?mode=ranked`).then((r) => r.json());
  const all = truthOf();
  const truth = new Map(ranked.items.map((i) => [i.id, all.get(i.id)]));
  const players = [['1111111110', [90]], ['1101101101', [80, 70]], ['1010101010', [100, 60]], ['1111110000', [70]]];
  for (const [i, [pattern, confs]] of players.entries()) {
    await playRoundApi(base, ranked, `demoApi${Date.now().toString(36)}${i}`.padEnd(22, 'x'), pattern, confs); // for the rank tile
  }
  const dir = mkdtempSync(join(tmpdir(), 'whosbluffing-demo-'));
  if (!only || only === 'square') await squareDemo(cdp, base, truth, dir);
  if (!only || only === 'poster') await demoPoster(cdp, base, dir);
  if (!only || only === 'vertical') await verticalDemo(cdp, base, truth, dir);
  // Copied in at the end: a write under public/ makes `wrangler pages dev` reload, which would break a take.
  for (const f of ['demo.mp4', 'demo.gif', 'demo-poster.png', 'demo-vertical.mp4', 'demo-vertical-poster.png']) {
    if (existsSync(join(dir, f))) { copyFileSync(join(dir, f), join(PRESS, f)); console.log(`wrote web/public/press/${f}`); }
  }
  rmSync(dir, { recursive: true, force: true });
}

const [mode = 'assets', base = 'http://127.0.0.1:8788', part] = process.argv.slice(2);
const cdp = await launch();
let failed = 0;
try {
  if (mode === 'assets') await assets(cdp);
  else if (mode === 'screens') await screens(cdp, base);
  else if (mode === 'checks') failed = await checks(cdp, base);
  else if (mode === 'rounds') await roundScreens(cdp, base);
  else if (mode === 'results') await resultScreens(cdp, base);
  else if (mode === 'demo') await demo(cdp, base, part);
  else throw new Error(`unknown mode ${mode} (assets | screens | checks | rounds | results | demo)`);
} finally {
  cdp.close();
}
process.exit(failed ? 1 : 0);
