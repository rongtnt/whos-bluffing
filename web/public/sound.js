// Sound effects, synthesised with WebAudio (no audio files). Every sound follows a tap, so the AudioContext is created
// or resumed inside a user gesture. Without WebAudio (old browsers, node tests) every method is a no-op.
// isOn() is read before each sound: the speaker toggles in the nav and on the game screen (site.js keeps the setting).

const NOOP = Object.freeze({ ding() {}, womp() {}, tick() {}, fanfare() {} });
const C5 = 523.25;

export function createSound({ isOn = () => true, Ctx = globalThis.AudioContext ?? globalThis.webkitAudioContext } = {}) {
  if (typeof Ctx !== 'function') return NOOP;
  let ctx = null;
  const audio = () => {
    try {
      ctx ??= new Ctx();
      if (ctx.state === 'suspended') ctx.resume();
      return ctx;
    } catch {
      return null; // blocked or unsupported: stay silent
    }
  };
  // One note: an oscillator through a short attack/release envelope (no clicks), starting `at` seconds from now.
  const note = (a, freq, at, dur, { type = 'sine', gain = 0.12, to } = {}) => {
    const t = a.currentTime + at;
    const osc = a.createOscillator();
    const env = a.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t);
    if (to) osc.frequency.exponentialRampToValueAtTime(to, t + dur);
    env.gain.setValueAtTime(0.0001, t);
    env.gain.exponentialRampToValueAtTime(gain, t + 0.012);
    env.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    osc.connect(env).connect(a.destination);
    osc.start(t);
    osc.stop(t + dur + 0.02);
  };
  const play = (fn) => {
    if (!isOn()) return;
    const a = audio();
    if (a) fn(a);
  };
  return {
    // Right: two rising notes, higher and brighter the bigger the stake.
    ding: (conf = 80) => play((a) => {
      const lift = 1 + (conf - 50) / 100; // 1 at 50%, 1.5 at 100%
      const type = conf >= 90 ? 'triangle' : 'sine';
      note(a, C5 * lift, 0, 0.14, { type });
      note(a, C5 * 1.5 * lift, 0.09, 0.26, { type });
    }),
    // Wrong: a short descending womp, longer at 100%.
    womp: (conf = 80) => play((a) => {
      const dur = conf === 100 ? 0.7 : 0.38;
      note(a, 196, 0, dur, { type: 'triangle', gain: 0.14, to: 98 });
    }),
    // A confidence tap.
    tick: () => play((a) => note(a, 1800, 0, 0.03, { type: 'square', gain: 0.03 })),
    // The end of a round with a positive score: C-E-G-C.
    fanfare: () => play((a) => [1, 1.26, 1.5, 2].forEach((m, i) => note(a, C5 * m, i * 0.11, i === 3 ? 0.42 : 0.16, { type: 'triangle', gain: 0.1 }))),
  };
}
