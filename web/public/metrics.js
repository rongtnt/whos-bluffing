// Calibration metrics, shared by the API (functions/_metrics.js re-exports this file) and the frontend.
// conf is a probability 0.5–1.0 (the UI shows 50–100%); correct is 0/1.
// Definitions: analysis/test_vectors.json, checked by `npm test`.

export const LEVELS = [0.5, 0.6, 0.7, 0.8, 0.9, 1.0];
export const NOMINAL = 0.9;

export const mean = (xs) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null);
export const round6 = (x) => (x == null ? null : Math.round(x * 1e6) / 1e6);

export const overconfidence = (conf, correct) => (conf.length ? mean(conf) - mean(correct) : null);

export const brier = (conf, correct) => mean(conf.map((c, i) => (c - correct[i]) ** 2));

// Probability that a correct answer got higher confidence than a wrong one; ties count 0.5.
export function auroc(conf, correct) {
  const pos = conf.filter((_, i) => correct[i] === 1);
  const neg = conf.filter((_, i) => correct[i] === 0);
  if (!pos.length || !neg.length) return null;
  let s = 0;
  for (const p of pos) for (const q of neg) s += p > q ? 1 : p === q ? 0.5 : 0;
  return s / (pos.length * neg.length);
}

export const bins = (conf, correct) =>
  LEVELS.map((lv) => {
    const ys = correct.filter((_, i) => Math.abs(conf[i] - lv) < 1e-9);
    return { conf: lv, n: ys.length, acc: mean(ys) };
  });

export const intervalHitRate = (low, high, truth) =>
  mean(truth.map((t, i) => (low[i] <= t && t <= high[i] ? 1 : 0)));

export function intervalOverconfidence(low, high, truth) {
  const h = intervalHitRate(low, high, truth);
  return h == null ? null : NOMINAL - h;
}

// Scores one validated session. answers: [{id, choice, conf (50..100), low, high, rt_ms}];
// items: Map id -> item from items.json. Attention items only decide passed_attention.
export function scoreSession(answers, items) {
  const stored = answers.map((a) => {
    const it = items.get(a.id);
    const rt_ms = Math.round(a.rt_ms);
    if (it.type === 'interval') {
      return { id: a.id, type: it.type, low: a.low, high: a.high, rt_ms, hit: a.low <= it.answer && it.answer <= a.high ? 1 : 0 };
    }
    return { id: a.id, type: it.type, choice: a.choice, conf: a.conf, rt_ms, correct: a.choice === it.answer ? 1 : 0 };
  });
  const two = stored.filter((a) => a.type === '2afc');
  const ints = stored.filter((a) => a.type === 'interval');
  const att = stored.filter((a) => a.type === 'attention');
  const conf = two.map((a) => a.conf / 100);
  const correct = two.map((a) => a.correct);
  const low = ints.map((a) => a.low);
  const high = ints.map((a) => a.high);
  const truth = ints.map((a) => items.get(a.id).answer);
  return {
    answers: stored,
    scores: {
      acc: round6(mean(correct)),
      mean_conf: round6(mean(conf)),
      overconf: round6(overconfidence(conf, correct)),
      brier: round6(brier(conf, correct)),
      auroc: round6(auroc(conf, correct)),
      int_hit: round6(intervalHitRate(low, high, truth)),
      int_overconf: round6(intervalOverconfidence(low, high, truth)),
    },
    bins: bins(conf, correct).map((b) => ({ ...b, acc: round6(b.acc) })),
    interval_detail: ints.map((a, i) => ({ id: a.id, low: a.low, high: a.high, truth: truth[i], hit: a.hit })),
    passed_attention: att.length > 0 && att.every((a) => a.correct === 1),
    n_2afc: two.length,
    n_interval: ints.length,
    total_rt_ms: stored.reduce((s, a) => s + a.rt_ms, 0),
  };
}
