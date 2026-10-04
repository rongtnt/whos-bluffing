// The game's running commentary: one cheeky line after every answer, picked by what just happened. Cheeky, never
// cruel: no profanity and nothing about the player as a person. A line is a string, or [line, gentler] where mild mode
// (opened from a class code) swaps in the gentler one. {conf} = the stake, {run} = the length of the streak.
// Pure: rounds.js passes the answers so far, the lines already used and the randomness.

export const REACTIONS = {
  right_coin: [ // right at 50%
    "A coin flip. You're welcome, coin.",
    'Right, at 50%. The coin did the work.',
    'Lucky. You said so yourself.',
    'Correct, and refreshingly humble about it.',
    'Heads you win. Literally.',
    "A guess that landed. We'll allow it.",
    "Right, but zero points. That's the deal you made.",
    'The coin sends its regards.',
    'You shrugged and it worked. Respect.',
    'Right on a coin flip. Next time, believe in yourself a little.',
    'Correct. Your confidence stayed home, though.',
    'Fifty-fifty, and the fifty went your way.',
    'Even a shrug is right half the time.',
    'Nice guess. Honest one, too.',
  ],
  right_mid: [ // right at 60-80%
    'Fine. Fine. You knew that.',
    'Right at {conf}%. Sensible. Annoyingly sensible.',
    'Correct, and not even smug about it.',
    'Look at you, knowing things.',
    'Right. Could you have said more than {conf}%?',
    'Nicely done. Measured and right.',
    'Right, with a sensible {conf}%. Very grown-up.',
    'You hedged and still won. Diplomatic.',
    'Correct. The quiet confidence suits you.',
    'That was a knowing {conf}%.',
    'Points on the board. Modest ones, but points.',
    'Right. You suspected as much.',
    'Solid. Not flashy, just solid.',
    'A sensible bet that paid off.',
  ],
  right_sure: [ // right at 90-100%
    ['Called it. Insufferable, but called it.', 'Called it. Well played.'],
    '{conf}% and right. Take a bow.',
    'Bold call. Correct call.',
    'You were sure, and you were right. Rare combo.',
    'Stake it all, win it all.',
    'All in, and the house pays out.',
    ["Confident and correct. Don't let it go to your head.", 'Confident and correct. Lovely.'],
    "That's how you stake {conf}%.",
    'Right, and you knew it. We noticed.',
    'No hedging, no regrets.',
    'A {conf}% call that held up. Smugness allowed.',
    'Big stake, big points.',
    'Correct. The confidence was earned this time.',
    "You didn't blink. Neither did the answer.",
  ],
  wrong_coin: [ // wrong at 50%
    'Coin flip, no harm done.',
    'Wrong, but you called it a coin flip. Zero lost.',
    'The coin let you down. Not you.',
    'A shrug and a miss. Costs nothing.',
    'Fifty-fifty. This time it was the other fifty.',
    'Wrong, and you saw it coming. Fair play.',
    "No points lost. That's the beauty of 50%.",
    'An honest guess that missed. Still honest.',
    'Tails. Better luck on the next one.',
    "You didn't know, and you said so. That's the game.",
    'A miss at 50% is just weather.',
    'Wrong, free of charge.',
    'The safest wrong answer there is.',
    'Not knowing, done properly.',
  ],
  wrong_mid: [ // wrong at 60-80%
    ['{conf}% sure and wrong. Classic.', '{conf}% sure and wrong. It happens.'],
    'Wrong at {conf}%. That one stings a little.',
    'Plausible. Also wrong.',
    'Fairly sure, fully wrong.',
    'The other one, as it turns out.',
    ['{conf}%? The source would like a word.', '{conf}%? The source says otherwise.'],
    'Close. Not close enough.',
    'That {conf}% just cost you some points.',
    'Wrong, but in a sensible way.',
    'Not this time. Check the source.',
    "A reasonable bet that didn't come in.",
    ['Wrong, and a bit too sure about it.', 'Wrong this time. The source is worth a look.'],
    'The facts disagreed, politely.',
    'Fair guess, wrong answer.',
  ],
  wrong_sure: [ // wrong at 90-100%
    ['{conf}%? Bold. Wrong, but bold.', '{conf}% sure, and it went the other way.'],
    ['All in, all gone.', 'A big stake on this one. The next one is a fresh start.'],
    ["That's a {conf}% we'll be talking about.", "That's a lot of confidence for this one."],
    ['Certain. Also wrong. Busy day.', 'Very sure, not right this time.'],
    'The house always wins.',
    'Ouch. That one had a big stake on it.',
    '{conf}% sure about the wrong one. It happens to the best.',
    ['Confidence: high. Accuracy: elsewhere.', 'Confidence high, answer not.'],
    ['Bluff called.', 'Well, that one was a surprise.'],
    "That's why we don't stake it all.",
    'Big call. The source says no.',
    'The red square has your name on it.',
    'A confident miss. Very on brand for this game.',
    'Now you know. Expensively.',
  ],
  streak_right: [ // three, six or nine right in a row
    'Okay, show-off.',
    ['{run} in a row. Are you reading the sources in advance?', '{run} in a row. Impressive.'],
    'A streak of {run}. Carry on.',
    ["{run} right. We're starting to suspect you.", '{run} right. Nicely done.'],
    ["On a roll. Don't get cocky.", 'On a roll. Keep going.'],
    ['Streak! Somebody stop them.', 'Streak! Lovely work.'],
    ['{run} for {run}. Insufferable.', '{run} for {run}. Brilliant.'],
  ],
  streak_wrong: [ // three, six or nine wrong in a row
    ['Should we talk?', 'Tough run. The next one is a fresh start.'],
    '{run} wrong in a row. Deep breath.',
    "Rough patch. The next one's yours.",
    'Okay, the questions are winning this round.',
    '{run} misses. Maybe try a lower stake?',
    'Not your streak. Shake it off.',
    'Lower the stakes, rebuild the empire.',
  ],
  after_all_in: [ // wrong right after a 100% answer
    ['The house thanks you.', 'After an all-in, a miss. That happens.'],
    ['From 100% to this. Quite a journey.', 'From 100% to a miss. Steady on.'],
    'Easy come, easy go.',
    "The confidence from the last one didn't carry over.",
    ['All in last time. Maybe ease off the gas?', 'All in last time; this one was harder.'],
    ['Momentum: gone.', 'Momentum: paused.'],
    "That's the risk of living at 100%.",
  ],
  // The AI pack (pair categories ai_*), copied from posts/ai-humor.md section 1; a line in AI_SURE needs a stake of 90%+.
  ai_right: [
    "Shipped before the competitor's blog post. Nice.",
    "Correct, and released without a waitlist.",
    "Right. No system card needed for that one.",
    "Correct at {conf}%. Better calibrated than most launch dates.",
    "Right, and nobody had to rename it afterwards.",
    "Right. In a lab, that answer would ship as v2-pro-max-preview.",
    "Correct, in less time than a model naming meeting.",
    "Right, and nobody had to announce it in a livestream.",
  ],
  ai_wrong: [
    "Confident, unverified, and already deprecated.",
    "Somewhere a lab is drafting a safety post about that answer.",
    "{conf}% sure and wrong. The labs call that a hallucination.",
    "Wrong, but announced with the confidence of a launch event.",
    "Not quite. A new version of that answer ships this afternoon.",
    "Wrong. It won't be mentioned in the release notes.",
    "That answer has been rolled back.",
    "Wrong at {conf}%. The benchmark looked so promising.",
  ],
  last: [ // the last question of a round
    "That's the round. Let's count the damage.",
    "That's the lot. Drumroll, please.",
    "And that's the round. Scores incoming.",
    'Pencils down.',
    "Last one, done. Let's see who was bluffing.",
    'Final answer locked. Here comes the verdict.',
    "That's all of them. Moment of truth.",
  ],
};

// AI-pack lines written for a stake of 90% or more.
export const AI_SURE = new Set(["Confident, unverified, and already deprecated.", "{conf}% sure and wrong. The labs call that a hallucination.", "Wrong, but announced with the confidence of a launch event."]);

// Is answer a about an AI-pack pair? (truth.category from POST /api/round/answer)
export const isAiPair = (a) => /^ai_/.test(a?.category ?? a?.truth?.category ?? '');

// The bucket for answer k of n; answers[0..k] = [{correct, conf, category?}] in round order (later ones are ignored).
// An AI-pack pair takes the AI lines, except in mild mode (class mode), which keeps the general ones.
export function reactionBucket(answers, k, n, { mild = false } = {}) {
  const a = answers[k];
  if (isAiPair(a) && !mild) return a.correct ? 'ai_right' : 'ai_wrong';
  if (k === n - 1) return 'last';
  const run = streak(answers, k);
  if (!a.correct && run % 3 === 0) return 'streak_wrong';
  if (!a.correct && answers[k - 1]?.conf === 100) return 'after_all_in';
  if (a.correct && run % 3 === 0) return 'streak_right';
  const stake = a.conf >= 90 ? 'sure' : a.conf >= 60 ? 'mid' : 'coin';
  return `${a.correct ? 'right' : 'wrong'}_${stake}`;
}

// How many answers in a row, ending at k, were right (or wrong) like answer k.
export function streak(answers, k) {
  let run = 0;
  for (let i = k; i >= 0 && answers[i].correct === answers[k].correct; i -= 1) run += 1;
  return run;
}

// A bucket's lines as shown: the gentler text in mild mode.
export const linesOf = (bucket, mild = false) => REACTIONS[bucket].map((l) => (Array.isArray(l) ? l[mild ? 1 : 0] : l));

const fill = (line, vars) => line.replace(/\{(conf|run)\}/g, (m, k) => String(vars[k]));

// One line for answer k: a line from its bucket not used yet in this round (`used` holds the template texts), at random.
// Returns {bucket, template, text}. Only when a bucket is spent does a line come round again.
export function pickReaction(answers, k, n, used = new Set(), { mild = false, rand = Math.random } = {}) {
  const bucket = reactionBucket(answers, k, n, { mild });
  const all = linesOf(bucket, mild).filter((l) => !AI_SURE.has(l) || answers[k].conf >= 90);
  const fresh = all.filter((l) => !used.has(l));
  const pool = fresh.length ? fresh : all;
  const template = pool[Math.floor(rand() * pool.length)];
  return { bucket, template, text: fill(template, { conf: answers[k].conf, run: streak(answers, k) }) };
}

// The round's best line for the share text: the one said after the answer that scored the most (the first on a tie).
export function bestLine(items, answers) {
  let best = null;
  for (const it of items) {
    const a = answers[it.id];
    if (a?.line && (!best || a.points > best.points)) best = a;
  }
  return best?.line ?? null;
}
