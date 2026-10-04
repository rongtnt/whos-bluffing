// The sound of the press clips (render.js demo), rendered sample by sample at 48 kHz with no dependencies. The tick,
// the womp and the chime are the product's own sounds, ported from public/sound.js (same oscillators, frequencies,
// gains and envelopes); the BLUFF stamp gets a low thud and a paper slap; under them runs a minimal 100 BPM bed (kick,
// hats, bass pulse, a low drone and one riser) that stops dead for the reveal. Times are seconds from the cut's start.
export const SR = 48000;
const C5 = 523.25;
const BEAT = 60 / 100;
const TAU = Math.PI * 2;

const buffer = (seconds) => [new Float32Array(Math.ceil(seconds * SR)), new Float32Array(Math.ceil(seconds * SR))];

// Deterministic noise, so a re-render sounds the same.
function noise(seed) {
  let s = seed >>> 0;
  return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 2 ** 31) - 1;
}

// A band-limited oscillator sample at phase p (cycles) for a fundamental f: the harmonics WebAudio's own square and
// triangle waves are built from, up to the Nyquist frequency.
function wave(type, p, f) {
  if (type === 'sine') return Math.sin(TAU * p);
  let y = 0;
  for (let n = 1; n * f < SR / 2; n += 2) {
    y += type === 'square' ? Math.sin(TAU * n * p) / n : ((n % 4 === 1 ? 1 : -1) * Math.sin(TAU * n * p)) / (n * n);
  }
  return type === 'square' ? (4 / Math.PI) * y : (8 / (Math.PI * Math.PI)) * y;
}

// sound.js note(): an oscillator (gliding exponentially to `to`) through 0.0001 -> gain in 12 ms -> 0.0001 at dur.
export function note([L, R], at, freq, dur, { type = 'sine', gain = 0.12, to, level = 1 } = {}) {
  const i0 = Math.round(at * SR);
  let p = 0;
  for (let k = 0; k < Math.round((dur + 0.02) * SR) && i0 + k < L.length; k += 1) {
    const t = k / SR;
    const f = to ? freq * (to / freq) ** (Math.min(t, dur) / dur) : freq;
    const env = t < 0.012 ? 0.0001 * (gain / 0.0001) ** (t / 0.012) : t < dur ? gain * (0.0001 / gain) ** ((t - 0.012) / (dur - 0.012)) : 0.0001;
    p += f / SR;
    const y = wave(type, p, f) * env * level;
    L[i0 + k] += y;
    R[i0 + k] += y;
  }
}

export const tick = (buf, at, level) => note(buf, at, 1800, 0.03, { type: 'square', gain: 0.03, level });
export const womp = (buf, at, level) => note(buf, at, 196, 0.7, { type: 'triangle', gain: 0.14, to: 98, level }); // at 100%
export const chime = (buf, at, level) => [1, 1.26, 1.5].forEach((m, i) =>
  note(buf, at + i * 0.11, C5 * m, i === 2 ? 0.42 : 0.16, { type: 'triangle', gain: 0.1, level })); // the fanfare's C-E-G

// A biquad band-pass (RBJ), returning a per-sample filter.
function bandpass(freq, q) {
  let x1 = 0, x2 = 0, y1 = 0, y2 = 0;
  return (x, f = freq) => {
    const w = (TAU * f) / SR;
    const alpha = Math.sin(w) / (2 * q);
    const a0 = 1 + alpha;
    const y = ((alpha * x) - (alpha * x2) - (-2 * Math.cos(w)) * y1 - (1 - alpha) * y2) / a0;
    x2 = x1; x1 = x; y2 = y1; y1 = y;
    return y;
  };
}
const highpass = (freq) => { // one pole
  const a = Math.exp((-TAU * freq) / SR);
  let x1 = 0, y1 = 0;
  return (x) => { const y = a * (y1 + x - x1); x1 = x; y1 = y; return y; };
};

// Adds n samples from `at` of fn(t, k) to both channels (pan -1..1).
function add([L, R], at, seconds, fn, pan = 0) {
  const i0 = Math.round(at * SR);
  for (let k = 0; k < Math.round(seconds * SR) && i0 + k < L.length; k += 1) {
    const y = fn(k / SR, k);
    L[i0 + k] += y * Math.min(1, 1 - pan);
    R[i0 + k] += y * Math.min(1, 1 + pan);
  }
}

// The stamp: a low thud (70 -> 42 Hz, 4 ms attack, 0.35 s decay) and, 3 ms on, a paper slap (band-passed noise).
export function stampHit(buf, at, level = 1) {
  let p = 0;
  add(buf, at, 0.6, (t) => {
    p += (42 + 28 * Math.exp(-t / 0.06)) / SR;
    return Math.sin(TAU * p) * Math.min(1, t / 0.004) * Math.exp(-t / 0.12) * 0.35 * level;
  });
  const n = noise(7);
  const bp = bandpass(1600, 0.7);
  add(buf, at + 0.003, 0.25, (t) => bp(n()) * Math.min(1, t / 0.001) * Math.exp(-t / 0.028) * 0.5 * level);
}

// The bed, keyed to the edit: { hookEnd, tapA, tap100, reveal, b, end, total } in seconds.
export function bed(cut) {
  const buf = buffer(cut.total);
  const n = noise(3);
  const kick = (at, level = 1) => {
    let p = 0;
    add(buf, at, 0.5, (t) => {
      p += (45 + 75 * Math.exp(-t / 0.03)) / SR;
      return Math.sin(TAU * p) * Math.min(1, t / 0.002) * Math.exp(-t / 0.16) * 0.42 * level;
    });
  };
  const hat = (at, level, pan) => {
    const hp = highpass(7000);
    add(buf, at, 0.12, (t) => hp(n()) * Math.exp(-t / 0.018) * 0.11 * level, pan);
  };
  const pulse = (at, freq, level) => { // the bass: a sine with a little drive, ducked under the kick by its own envelope
    add(buf, at, BEAT / 2, (t) => Math.tanh(1.8 * Math.sin(TAU * freq * t)) * Math.min(1, t / 0.01) * Math.exp(-t / 0.11) * 0.09 * level);
  };
  const D2 = 73.42;
  const grid = (from, to, fn) => { for (let t = from, i = 0; t < to - 1e-6; t += BEAT / 4, i += 1) fn(t, i); };
  // Groove: from the phone's arrival to the 100% tap, and on the end screen until the end card.
  for (const [from, to, lift] of [[cut.hookEnd, cut.tap100, 1], [cut.b, cut.end, 1.335]]) {
    grid(from, to, (t, i) => {
      if (i % 4 === 0) kick(t, i % 16 === 0 ? 1 : 0.8);
      if (i % 2 === 0) pulse(t, D2 * lift, i % 4 === 0 ? 0.6 : 1);
      const build = t > cut.tapA && to === cut.tap100; // 16ths while the stake is chosen
      if (i % 2 === 1 || build) hat(t, i % 4 === 2 ? 1 : 0.55, i % 2 ? 0.25 : -0.25);
    });
  }
  // A low drone (D2 and E-flat 2, a minor second) under everything but the stop.
  const drone = (from, to, level) => add(buf, from, to - from, (t) => {
    const fade = Math.min(1, t / 0.6, (to - from - t) / 0.4);
    return (Math.sin(TAU * D2 * t) + 0.7 * Math.sin(TAU * 77.78 * t + 1)) * 0.035 * level * fade * (0.8 + 0.2 * Math.sin(TAU * 0.5 * t));
  });
  drone(0, cut.reveal - 0.05, 1);
  drone(cut.reveal + 1.1, cut.end + 2, 0.8);
  // A riser while the stake is chosen, cut off at the tap.
  const bp = bandpass(400, 2.5);
  add(buf, cut.tapA, cut.tap100 - cut.tapA, (t) => {
    const f = t / (cut.tap100 - cut.tapA);
    return bp(n(), 300 * 20 ** f) * f * f * 0.22 * Math.min(1, (1 - f) * (cut.tap100 - cut.tapA) / 0.006);
  });
  // The end card: one low hit, then the bed fades away.
  kick(cut.end, 1.1);
  add(buf, cut.end, 1.6, (t) => Math.sin(TAU * 36.71 * t) * Math.exp(-t / 0.5) * 0.12);
  for (const ch of buf) {
    const stop = Math.round(cut.reveal * SR) - 240; // the stop: 15 ms down to silence
    for (let i = stop - 720; i < Math.round((cut.reveal + 1.1) * SR); i += 1) ch[i] *= Math.max(0, Math.min(1, (stop - i) / 720));
    for (let i = Math.round((cut.total - 1.2) * SR); i < ch.length; i += 1) ch[i] *= Math.max(0, (ch.length - i) / (1.2 * SR));
  }
  return buf;
}

// The effects, keyed to the edit: { total, words, taps, reveal, stamp, endCard } (seconds).
export function effects(cut) {
  const buf = buffer(cut.total);
  for (const t of cut.words) tick(buf, t, 2.6);
  for (const t of cut.taps) tick(buf, t, 4);
  stampHit(buf, cut.stamp, 1);
  womp(buf, cut.reveal, 1.6);
  chime(buf, cut.endCard, 1.7);
  return buf;
}

// Music under the effects, ducked by duckDb wherever an effect sounds (10 ms down, 250 ms back up).
export function mix(music, sfx, duckDb = -4) {
  const out = buffer(music[0].length / SR);
  const low = 10 ** (duckDb / 20);
  const down = Math.exp(-1 / (0.01 * SR));
  const up = Math.exp(-1 / (0.25 * SR));
  let g = 1;
  for (let i = 0; i < out[0].length; i += 1) {
    const loud = Math.max(Math.abs(sfx[0][i] ?? 0), Math.abs(sfx[1][i] ?? 0)) > 0.002;
    const target = loud ? low : 1;
    g = target + (g - target) * (target < g ? down : up);
    for (let c = 0; c < 2; c += 1) out[c][i] = (music[c][i] ?? 0) * g + (sfx[c][i] ?? 0);
  }
  return out;
}

// A 32-bit float stereo WAV.
export function wav([L, R]) {
  const n = L.length;
  const b = Buffer.alloc(44 + n * 8);
  b.write('RIFF', 0); b.writeUInt32LE(36 + n * 8, 4); b.write('WAVE', 8); b.write('fmt ', 12);
  b.writeUInt32LE(16, 16); b.writeUInt16LE(3, 20); b.writeUInt16LE(2, 22); b.writeUInt32LE(SR, 24);
  b.writeUInt32LE(SR * 8, 28); b.writeUInt16LE(8, 32); b.writeUInt16LE(32, 34); b.write('data', 36); b.writeUInt32LE(n * 8, 40);
  for (let i = 0; i < n; i += 1) { b.writeFloatLE(L[i], 44 + i * 8); b.writeFloatLE(R[i], 48 + i * 8); }
  return b;
}

// Reads interleaved float32 stereo PCM (ffmpeg -f f32le -ac 2) into two channels of `seconds`.
export function fromPcm(raw, seconds) {
  const buf = buffer(seconds);
  const f = new Float32Array(raw.buffer, raw.byteOffset, Math.floor(raw.length / 4));
  for (let i = 0; i < buf[0].length && 2 * i + 1 < f.length; i += 1) { buf[0][i] = f[2 * i]; buf[1][i] = f[2 * i + 1]; }
  return buf;
}
