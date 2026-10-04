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
//                                          (1200x675), demo-vertical.mp4 (1080x1920), demo-vertical-poster.png and
//                                          design/screens/demo-vertical-frames.png (or one part): design/intro.html seeked
//                                          frame by frame, then today's ranked round played in the page on a stand-in
//                                          clock, so every 1/30 s frame is exact; cut with eased crossfades by ffmpeg
//                                          (FFMPEG=/path/to/ffmpeg picks another one)
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
const INTRO_S = 4.6; // design/intro.html: 4.0 s of motion, then a 0.6 s hold
const FADE_S = 0.4; // every cut is an eased crossfade this long
const END_S = 3; // the end card, after its crossfade
const CUT_S = 25;
const ROUND_S = CUT_S - INTRO_S - END_S; // the round's segments, crossfades included
const PUSH = 0.04; // the round's slow push-in, scale 1.00 to 1.04
// Smoothstep on xfade's progress P (1 to 0), so a crossfade starts and ends gently.
const EASED = "xfade=transition=custom:expr='A*(P*P*(3-2*P))+B*(1-P*P*(3-2*P))'";
// Ten answers per take, [right, conf]; a take films the leading ones and plays the rest off camera. Both end
// Hot-headed (7 of 10 right at 81 to 82% sure), the 100% miss giving the roast line.
const SQUARE_PLAN = [[1, 80], [0, 100], [1, 90], [1, 80], [0, 70], [1, 80], [1, 80], [0, 80], [1, 80], [1, 80]];
const VERTICAL_PLAN = [[0, 100], [1, 80], [0, 70], [1, 80], [1, 80], [0, 80], [1, 80], [1, 80], [1, 80], [1, 80]];
// Chrome's JPEG shots are full-range BT.601; the videos are limited-range BT.709, tagged so.
const TO_709 = 'scale=out_color_matrix=bt709:out_range=tv,setsar=1,format=yuv420p';
const TAGS_709 = ['-colorspace', 'bt709', '-color_primaries', 'bt709', '-color_trc', 'bt709', '-color_range', 'tv'];

function ffmpeg(...args) {
  const r = spawnSync(FFMPEG, ['-y', '-loglevel', 'error', ...args.map(String)], { stdio: 'inherit' });
  if (r.status !== 0) throw new Error(`ffmpeg exited with ${r.status}: ${args.join(' ')}`);
}

const shoot = async (cdp, file, format = 'jpeg') => {
  const { data } = await cdp.send('Page.captureScreenshot', format === 'png' ? { format } : { format, quality: 92, optimizeForSpeed: true });
  writeFileSync(file, Buffer.from(data, 'base64'));
};

// The intro at w x h, one PNG per frame from 0 to INTRO_S, each seeked to its exact time; returns the files.
async function introFrames(cdp, dir, w, h) {
  mkdirSync(dir, { recursive: true });
  await open(cdp, `file://${WEB}design/intro.html?w=${w}&h=${h}`, { width: w, height: h, mobile: false, motion: 'no-preference', waitReady: false });
  const files = [];
  for (let i = 0; i < Math.round(INTRO_S * FPS); i += 1) {
    await evaluate(cdp, `seek(${(i * 1000) / FPS})`);
    files.push(join(dir, `i${String(i).padStart(4, '0')}.png`));
    await shoot(cdp, files.at(-1), 'png');
  }
  return files;
}

// Installed before the page's scripts: performance.now, requestAnimationFrame and setTimeout only move on __tick(ms),
// and so does every CSS and scripted animation (paused, then set to the time since it began). A frame shot after each
// tick is exact however long the screenshot takes.
const VIRTUAL_CLOCK = `(() => {
  let now = 0, ids = 0;
  const frames = new Map(), timers = new Map(), born = new WeakMap();
  performance.now = () => now;
  window.requestAnimationFrame = (f) => { frames.set(++ids, f); return ids; };
  window.cancelAnimationFrame = (id) => { frames.delete(id); };
  window.setTimeout = (f, ms, ...args) => { timers.set(++ids, [now + (Number(ms) || 0), f, args]); return ids; };
  window.clearTimeout = (id) => { timers.delete(id); };
  const sync = () => { for (const a of document.getAnimations()) { if (!born.has(a)) { born.set(a, now); a.pause(); } a.currentTime = now - born.get(a); } };
  window.__tick = (ms) => {
    sync();
    const end = now + ms;
    for (let next; (next = [...timers].filter(([, t]) => t[0] <= end).sort((x, y) => x[1][0] - y[1][0])[0]);) {
      timers.delete(next[0]); now = Math.max(now, next[1][0]); next[1][1](...next[1][2]); sync();
    }
    now = end;
    const due = [...frames.values()]; frames.clear(); for (const f of due) f(now);
    sync();
    return now;
  };
})();`;

// In the page: no nav, the round `top` px down, and in that clear band the captions (800 weight, ink, fading in and
// out); __push(s) scales the page about the middle of the screen.
const stageSetup = (top, px) => `(() => {
  document.querySelector('.nav').style.display = 'none';
  Object.assign(document.getElementById('app').style, { paddingTop: '${top}px', scrollMarginTop: '0' });
  const band = document.createElement('div');
  Object.assign(band.style, { position: 'fixed', inset: '0 0 auto', height: '${top}px', display: 'grid', placeItems: 'center', pointerEvents: 'none', zIndex: '60' });
  document.documentElement.append(band);
  const ease = { duration: 450, easing: 'cubic-bezier(0.22, 1, 0.36, 1)', fill: 'both' };
  window.__caption = (text) => {
    for (const old of band.querySelectorAll('p:not(.out)')) { old.classList.add('out'); old.animate([{ opacity: 1 }, { opacity: 0 }], ease); }
    if (!text) return true;
    const p = document.createElement('p');
    p.textContent = text;
    Object.assign(p.style, { gridArea: '1 / 1', margin: '0', padding: '0 ${Math.round(px * 0.6)}px', font: '800 ${px}px/1.12 var(--font)',
      letterSpacing: '-0.02em', color: 'var(--text)', textAlign: 'center', textWrap: 'balance' });
    band.append(p);
    p.animate([{ opacity: 0, transform: 'translateY(6px)' }, { opacity: 1, transform: 'none' }], { ...ease, delay: 150 });
    return true;
  };
  window.__clear = () => { band.replaceChildren(); return true; };
  window.__push = (s) => { const b = document.body; b.style.transformOrigin = innerWidth / 2 + 'px ' + (scrollY + innerHeight / 2) + 'px'; b.style.transform = 'scale(' + s + ')'; return true; };
  return true; })()`;

// A fresh player in this browser (sound off).
async function freshPlayer(cdp, base, view) {
  await open(cdp, `${base}/support`, view);
  await evaluate(cdp, `localStorage.clear(); localStorage.setItem('whosbluffing_anon', ${JSON.stringify(JSON.stringify(`demo${Date.now().toString(36)}`.padEnd(22, 'p')))});
    localStorage.setItem('whosbluffing_sound', 'off'); true`);
}

// In the page: taps the right (or wrong) option of the question on screen.
const pickExpr = (truth, right) => `(() => { const st = JSON.parse(localStorage.getItem('whosbluffing_round'));
  const k = st.items.findIndex((i) => !st.answers[i.id]); const t = ${JSON.stringify(Object.fromEntries(truth))}[st.items[k].id];
  document.querySelectorAll('button.pick')[${right ? 't' : '1 - t'}].click(); return true; })()`;
const confButton = (conf) => `document.querySelector('#conf:not([hidden]) [data-conf="${conf}"]')`;

// A take of today's ranked round on the page's virtual clock (a fresh player, motion on). Segments of frames go to
// <dir>/<name>/f00000.jpg...; each one will start under the crossfade from the one before, and the push-in runs over
// the ROUND_S seconds they fill.
async function clockTake(cdp, base, dir, truth, view, { top, px }) {
  await freshPlayer(cdp, base, view);
  const { identifier } = await cdp.send('Page.addScriptToEvaluateOnNewDocument', { source: VIRTUAL_CLOCK });
  await open(cdp, `${base}/`, { ...view, motion: 'no-preference', waitReady: false });
  await cdp.send('Page.removeScriptToEvaluateOnNewDocument', { identifier });
  const js = (expr) => evaluate(cdp, expr);
  const until = async (expr) => {
    for (let i = 0; i < 500; i += 1) { if (await js(expr)) return; await sleep(20); }
    throw new Error(`timeout: ${expr}`);
  };
  await js(stageSetup(top, px));
  await js('__tick(1500)');
  await js(`document.getElementById('play').click(), true`);
  await until(`!!document.querySelector('button.pick')`);
  let seg = null;
  const take = {
    js, until,
    segment(name) {
      seg = { dir: join(dir, name), n: 0, at: seg ? seg.at + seg.n / FPS - FADE_S : 0 };
      mkdirSync(seg.dir, { recursive: true });
      return seg;
    },
    async film(seconds) { // frames, one clock tick each
      for (let i = 0; i < Math.round(seconds * FPS); i += 1) {
        await js(`__tick(${1000 / FPS}), __push(${1 + (PUSH * (seg.at + seg.n / FPS)) / ROUND_S})`);
        await shoot(cdp, join(seg.dir, `f${String(seg.n).padStart(5, '0')}.jpg`));
        seg.n += 1;
      }
    },
    async stake(conf, beatS) { // the button pressed for a beat, as under a finger, then the answer and its reveal
      await js(`${confButton(conf)}.setAttribute('aria-pressed', 'true'), true`);
      await take.film(beatS);
      await js(`${confButton(conf)}.click(), true`);
      await until(`!!document.querySelector('.reveal')`);
    },
    async next() { await js(`document.getElementById('next').click(), true`); await until(`!!document.querySelector('button.pick')`); },
    async offCamera(plan) { // the remaining answers, then the end screen at the top of the screen
      for (const [right, conf] of plan) {
        await take.next();
        await js(pickExpr(truth, right));
        await js('__tick(1500)'); // a believable answer time (rt_ms) and settled motion
        await js(`${confButton(conf)}.click(), true`);
        await until(`!!document.querySelector('.reveal')`);
      }
      await js(`__clear(), __push(1), document.getElementById('next').click(), true`);
      await until(`!!document.querySelector('.result-title')`);
      await js(`document.getElementById('app').scrollIntoView({ behavior: 'instant' }), true`);
    },
  };
  return take;
}

// One cut: the intro, the round's segments and the end card, each joined to the next by an eased crossfade.
function cut(out, { intro, segments, end, crop = '' }) {
  const round = segments.reduce((s, g) => s + g.n / FPS, 0) - (segments.length - 1) * FADE_S;
  if (Math.abs(round - ROUND_S) > 0.5 / FPS) throw new Error(`the round's segments fill ${round.toFixed(3)} s, not ${ROUND_S} s`);
  const inputs = [['-framerate', FPS, '-i', join(intro, 'i%04d.png')], ...segments.map((g) => ['-framerate', FPS, '-i', join(g.dir, 'f%05d.jpg')]),
    ['-loop', 1, '-framerate', FPS, '-t', END_S + FADE_S, '-i', end]];
  const lens = [INTRO_S + FADE_S, ...segments.map((g) => g.n / FPS), END_S + FADE_S];
  const graph = [`[0:v]${TO_709},tpad=stop_mode=clone:stop_duration=${FADE_S}[s0]`,
    ...segments.map((g, k) => `[${k + 1}:v]${crop}${TO_709}[s${k + 1}]`), `[${lens.length - 1}:v]${TO_709}[s${lens.length - 1}]`];
  let length = lens[0];
  for (let k = 1; k < lens.length; k += 1) {
    const offset = length - FADE_S;
    graph.push(`[${k === 1 ? 's0' : `x${k - 1}`}][s${k}]${EASED}:duration=${FADE_S}:offset=${offset.toFixed(4)}[x${k}]`);
    length = offset + lens[k];
  }
  ffmpeg(...inputs.flat(), '-filter_complex', graph.join(';'), '-map', `[x${lens.length - 1}]`, '-an', '-c:v', 'libx264', '-preset', 'slow', '-crf', 20, '-pix_fmt', 'yuv420p', ...TAGS_709,
    '-movflags', '+faststart', out);
}

// A still from an HTML string, width x height at 1x.
async function still(cdp, file, html, width, height) {
  const page = `${file}.html`;
  writeFileSync(page, html);
  await open(cdp, `file://${page}`, { width, height, mobile: false, waitReady: false });
  await capture(cdp, file, width, height);
}

// The end card: the lockup and the address on the paper background.
const endCardPage = (w, h) => `<!doctype html><html lang="en" data-theme="light"><head><meta charset="utf-8">
<link rel="stylesheet" href="file://${WEB}public/styles.css"><style>html { scrollbar-gutter: auto; } html, body { width: ${w}px; height: ${h}px; margin: 0; overflow: hidden; }
body { display: flex; flex-direction: column; align-items: center; justify-content: center; background: var(--bg); }
img { width: 960px; height: auto; } p { margin: 28px 0 0; font: 800 56px/1.2 var(--font); letter-spacing: -0.02em; color: var(--accent); }</style></head>
<body><img src="file://${PRESS}/logo.png" alt=""><p>whosbluffing.com</p></body></html>`;

// demo.mp4 (1080x1080, 25 s): the square intro, then a 600 px page at 1.8x playing question 1 right at 80% and
// question 2 wrong at 100% under three captions, the end screen under a fourth, and the end card. demo.gif: the two
// questions (from the end of the intro's crossfade to the start of the next one), 640 px, looping.
async function squareDemo(cdp, base, truth, dir) {
  console.log('square');
  const intro = join(dir, 'square-intro');
  await introFrames(cdp, intro, 1080, 1080);
  const t = await clockTake(cdp, base, join(dir, 'square'), truth, { width: 600, height: 600, scale: 1.8 }, { top: 84, px: 30 });
  const q1 = t.segment('q1');
  await t.film(0.5);
  await t.js(`__caption('Easy question. Pick one.')`); await t.film(1.4);
  await t.js(pickExpr(truth, true)); await t.js(`__caption('How sure are you?')`); await t.film(1.4);
  await t.stake(80, 0.3); await t.js(`__caption('')`); await t.film(2.7);
  await t.next();
  const q2 = t.segment('q2');
  await t.film(1.7);
  await t.js(pickExpr(truth, false)); await t.film(1.2);
  await t.stake(100, 0.3); await t.js(`__caption('100% sure. 100% wrong.')`); await t.film(3.5);
  await t.offCamera(SQUARE_PLAN.slice(2));
  const end = t.segment('end');
  await t.film(0.4);
  await t.js(`__caption('And yes, it roasts you.')`); await t.film(4.8);
  const card = join(dir, 'square-end.png');
  await still(cdp, card, endCardPage(1080, 1080), 1080, 1080);
  const mp4 = join(dir, 'demo.mp4');
  cut(mp4, { intro, segments: [q1, q2, end], end: card });
  const from = INTRO_S + FADE_S;
  ffmpeg('-ss', from, '-t', (q2.at + q2.n / FPS - 2 * FADE_S).toFixed(3), '-i', mp4, '-vf',
    'fps=15,scale=640:-1:flags=lanczos,split[a][b];[a]palettegen=stats_mode=diff[p];[b][p]paletteuse=dither=bayer:bayer_scale=5:diff_mode=rectangle',
    '-loop', 0, join(dir, 'demo.gif'));
}

// demo-vertical.mp4 (1080x1920, 25 s): the intro, then a 375 px page at 2.88 answering question 1 wrong at 100% under
// three captions, the end screen under a fourth, and the end card. demo-vertical-poster.png: the intro's closing
// frame. design/screens/demo-vertical-frames.png: six frames of the cut, for review.
async function verticalDemo(cdp, base, truth, dir) {
  console.log('vertical');
  const intro = join(dir, 'vertical-intro');
  const frames = await introFrames(cdp, intro, 1080, 1920);
  copyFileSync(frames.at(-1), join(dir, 'demo-vertical-poster.png'));
  const t = await clockTake(cdp, base, join(dir, 'vertical'), truth, { width: 375, height: 667, scale: 2.88 }, { top: 140, px: 27 });
  const q1 = t.segment('q1');
  await t.film(0.5);
  await t.js(`__caption('Easy question. Pick one.')`); await t.film(2.1);
  await t.js(pickExpr(truth, false)); await t.js(`__caption('How sure are you?')`); await t.film(2.0);
  await t.stake(100, 0.3); await t.js(`__caption('100% sure. 100% wrong.')`); await t.film(5.5);
  await t.offCamera(VERTICAL_PLAN.slice(1));
  const end = t.segment('end');
  await t.film(0.5);
  await t.js(`__caption('And yes, it roasts you.')`); await t.film(6.9);
  const card = join(dir, 'vertical-end.png');
  await still(cdp, card, endCardPage(1080, 1920), 1080, 1920);
  const mp4 = join(dir, 'demo-vertical.mp4');
  cut(mp4, { intro, segments: [q1, end], end: card, crop: 'crop=1080:1920:0:0,' });
  const sheet = [1.6, 4.4, 9.0, 12.5, 18.5, 23.5].map((s, i) => {
    const f = join(dir, `sheet${i}.png`);
    ffmpeg('-ss', s, '-i', mp4, '-frames:v', 1, '-vf', 'scale=360:-1:flags=lanczos', f);
    return f;
  });
  ffmpeg(...sheet.flatMap((f) => ['-i', f]), '-filter_complex', `hstack=inputs=${sheet.length}`, join(WEB, 'design/screens/demo-vertical-frames.png'));
}

// demo-poster.png (1200x675): the intro's closing frame at that size.
async function demoPoster(cdp, dir) {
  console.log('poster');
  await open(cdp, `file://${WEB}design/intro.html?w=1200&h=675`, { width: 1200, height: 675, mobile: false, motion: 'no-preference', waitReady: false });
  await evaluate(cdp, `seek(${INTRO_S * 1000})`);
  await capture(cdp, join(dir, 'demo-poster.png'), 1200, 675);
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
  if (!only || only === 'poster') await demoPoster(cdp, dir);
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
