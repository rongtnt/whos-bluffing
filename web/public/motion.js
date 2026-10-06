// Motion helpers. Everything moves with transform and opacity only, and every animated element carries the class
// `anim`, the reduced-motion fallback: under prefers-reduced-motion: reduce, styles.css stops its animations at their
// end state (stamps and confetti are not drawn), and the JavaScript motions below jump straight to their end.
// NOTES.md ("Motion") lists every animation; test/motion.test.js checks the classes against styles.css.

// Motion classes (styles.css) and what they do. Each element with one of them also has `anim`.
export const MOTION = {
  'anim-pop': 'pops in: scale up from 40% while fading in (result squares, tiles)',
  'anim-shake': 'shakes sideways once (a missed result square, a wrong pick)',
  'anim-flip': 'flips in around the vertical axis (the type card)',
  'anim-grow': 'grows up from the baseline (ranked-round histogram bars)',
  'anim-slide': 'slides up while fading in (leaderboard and side-by-side rows)',
  'anim-sweep': 'a green band sweeps across (the right answer)',
  'anim-flash': 'a red flash fades out (a confident miss)',
  'anim-stamp': 'a stamp slams in at an angle (BLUFF, Called it)',
  'anim-tick': 'a quick bump (the running total after it counts)',
  'anim-hit': 'a green pulse around the correct-answer result',
  'anim-miss': 'a red pulse around the wrong-answer result',
};

export const reducedMotion = () => typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
const raf = (f) => requestAnimationFrame(f);
const easeOut = (f) => 1 - (1 - f) ** 3;

// Deal each card into its slot, gather the deck, riffle, then spread it. Skip cancels both motion and pending ticks.
export async function dealCards(host, skip, tick = () => {}) {
  if (reducedMotion() || !host?.firstElementChild?.animate) return;
  const duration = 2600;
  const box = host.getBoundingClientRect();
  const timers = [];
  const animations = [...host.children].map((card, i) => {
    const r = card.getBoundingClientRect();
    const x = box.left + box.width / 2 - r.left - r.width / 2;
    const y = box.top + box.height / 2 - r.top - r.height / 2;
    const side = i % 2 ? 1 : -1;
    const stack = `translate(${x}px, ${y}px) rotate(${side * 4}deg) scale(.92)`;
    const at = .01 + i * .035;
    timers.push(setTimeout(tick, at * duration));
    return card.animate([
      { offset: 0, opacity: 0, transform: stack },
      { offset: at, opacity: 0, transform: stack, easing: 'ease-out' },
      { offset: at + .085, opacity: 1, transform: 'none' },
      { offset: .49, opacity: 1, transform: 'none', easing: 'ease-in-out' },
      { offset: .64, opacity: 1, transform: stack },
      { offset: .73, opacity: 1, transform: `translate(${x + side * 55}px, ${y - 12}px) rotate(${side * 14}deg)` },
      { offset: .82, opacity: 1, transform: stack },
      { offset: 1, opacity: 0, transform: 'scale(.9)' },
    ], { duration, fill: 'both' });
  });
  const cancel = () => { timers.forEach(clearTimeout); animations.forEach((a) => a.cancel()); };
  skip.onclick = cancel;
  try { await Promise.all(animations.map((a) => a.finished)); }
  catch { /* Skip cancels the animations' finished promises. */ }
  finally { cancel(); skip.onclick = null; }
}

// Counts el's text from `from` to `to` over ms (ease-out). Resolves when done; jumps to the end under reduced motion.
export function countTo(el, from, to, { ms = 550, format = String, ease = easeOut } = {}) {
  return new Promise((done) => {
    if (!el) { done(); return; }
    if (reducedMotion() || from === to || ms <= 0) { el.textContent = format(to); done(); return; }
    el.textContent = format(from); // before the next paint, so the end value never flashes first
    const t0 = performance.now();
    const step = (now) => {
      const f = Math.min(1, (now - t0) / ms);
      el.textContent = format(Math.round(from + (to - from) * ease(f)));
      if (f < 1) raf(step); else done();
    };
    raf(step);
  });
}

// Counts several numbers up from 0 at the same speed, so the biggest finishes last: a race. runners: [{el, to, format}].
export function raceTo(runners, { msPerPoint = 1.1, minMs = 350, maxMs = 1400 } = {}) {
  const top = Math.max(1, ...runners.map((r) => Math.abs(r.to)));
  const total = Math.min(maxMs, Math.max(minMs, top * msPerPoint));
  return Promise.all(runners.map((r) => countTo(r.el, 0, r.to, { ms: Math.max(120, (total * Math.abs(r.to)) / top), format: r.format, ease: (f) => f })));
}

// A short burst of particles (pieces of the mark, in green) from the middle of `host` (position: relative), removed
// after 700 ms.
// big: the 100% version (more, farther). Nothing under reduced motion. At most 40 particles.
export function confetti(host, { big = false, rand = Math.random } = {}) {
  if (!host || reducedMotion()) return null;
  const n = big ? 40 : 18;
  const layer = document.createElement('span');
  layer.className = 'confetti anim';
  layer.setAttribute('aria-hidden', 'true');
  for (let i = 0; i < n; i += 1) {
    const p = document.createElement('i');
    const angle = rand() * Math.PI * 2;
    const dist = (big ? 90 : 55) + rand() * (big ? 120 : 70);
    p.style.setProperty('--dx', `${Math.round(Math.cos(angle) * dist)}px`);
    p.style.setProperty('--dy', `${Math.round(Math.sin(angle) * dist * 0.75 - 20)}px`);
    p.style.setProperty('--r', `${Math.round(rand() * 540 - 270)}deg`);
    p.style.setProperty('--d', `${Math.round(rand() * 80)}ms`);
    layer.append(p);
  }
  host.append(layer);
  setTimeout(() => layer.remove(), 700);
  return layer;
}

// Tilts el a few degrees towards the pointer (rotateX/rotateY through CSS variables) and levels it on leave.
export function attachTilt(el, { max = 6 } = {}) {
  if (!el || reducedMotion()) return;
  let frame = 0;
  el.classList.add('tilt', 'anim');
  el.addEventListener('pointermove', (e) => {
    const r = el.getBoundingClientRect();
    const x = (e.clientX - r.left) / r.width - 0.5;
    const y = (e.clientY - r.top) / r.height - 0.5;
    cancelAnimationFrame(frame);
    frame = raf(() => {
      el.style.setProperty('--ry', `${(x * 2 * max).toFixed(2)}deg`);
      el.style.setProperty('--rx', `${(-y * 2 * max).toFixed(2)}deg`);
    });
  });
  el.addEventListener('pointerleave', () => {
    cancelAnimationFrame(frame);
    el.style.setProperty('--rx', '0deg');
    el.style.setProperty('--ry', '0deg');
  });
}
