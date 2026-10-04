// Message and component builders (Discord) and all user-facing copy. Pure: no I/O.

export const FAIL_TEXT = "Who's Bluffing is taking a break, try again in a minute.";
export const GUILD_ONLY = "Who's Bluffing works inside a server. Use /bluff invite to add it to one.";
export const NEED_MANAGE = 'Only members with the Manage Server permission can do that.';
export const CANT_POST =
  "I can't post in that channel. Give Who's Bluffing the View Channel and Send Messages permissions there, or pick another channel.";
export const TOO_LATE = 'Too late: answers for this question are closed.';
export const NOTHING_TO_REVEAL = "There is no question waiting for its answer. Type /bluff question to post today's.";
export const REVEALED = 'Revealed. The answer is on the question post.';
export const PLAY_ENDED = 'This round has ended. Type /bluff play for a new one.';
export const HELP = [
  "**Who's Bluffing** posts one question a day. Tap A or B, then say how sure you are. The answer and this server's top 5 come out 8 hours later. Every Monday brings last week's recap.",
  'Points reward honest confidence: 50% scores 0; 100% scores +100 if right and -300 if wrong.',
  '',
  "`/bluff question` post today's question in this channel now",
  '`/bluff play` play a private 10-question round',
  "`/bluff stats` this server's leaderboard for the last 30 days",
  "`/bluff invite` get a link to add Who's Bluffing to another server",
  '`/bluff setup` set the daily channel, hour (UTC) and roast mode (Manage Server)',
  "`/bluff reveal` reveal today's answer now (Manage Server)",
].join('\n');

export const BLUFF_CONF = 80; // a wrong answer at this confidence or more counts as a bluff
export const NO_PINGS = { parse: [] }; // sent with every message: names render, nobody is pinged

const DAY_MS = 86_400_000;
export const isoDate = (d) => d.toISOString().slice(0, 10);
export const addDays = (date, n) => isoDate(new Date(Date.parse(date) + n * DAY_MS));

const LETTERS = ['A', 'B'];
const CONF_ROWS = [[50, 60, 70], [80, 90, 100]];
const CONF_WORDS = { 50: 'coin flip', 100: 'stake it all' };
const NEGATIONS = { is: "It isn't.", was: "It wasn't.", came: "It didn't." };
const TYPE_LINES = {
  Bluffer: 'much more sure than right',
  'Hot-headed': 'a bit more sure than right',
  Calibrated: 'about as sure as right',
  Modest: 'a bit less sure than right',
  Hedger: 'much less sure than right',
};
const ROUND = "**Who's Bluffing? quick round**";
const MIN_CALIBRATED_ANSWERS = 3;
const MAX_LABEL = 80; // Discord's button label limit

// Discord markdown: escape what formats text or starts a mention, masked link, emoji or timestamp.
export const esc = (s) => String(s ?? '').replace(/[\\*_~`|<>[\]@]/g, '\\$&');
const plural = (n, word) => `${n} ${word}${n === 1 ? '' : 's'}`;
const signed = (n) => (n > 0 ? `+${n}` : String(n));
const pct = (k, n) => Math.round((100 * k) / n);
const label = (s) => (s.length > MAX_LABEL ? `${s.slice(0, MAX_LABEL - 1)}…` : s);
const utc = (iso) => `${iso.slice(11, 16)} UTC`;
const hourText = (h) => `${String(h).padStart(2, '0')}:00 UTC`;
const nameOf = (names, anonId) => esc(names.get(anonId) ?? 'a member');
const button = (customId, text, style = 2) => ({ type: 2, style, custom_id: customId, label: label(text) });
const row = (...components) => ({ type: 1, components });
const option = (q, choice) => `${LETTERS[choice]} · ${esc(choice ? q.b : q.a)}`;
const abButtons = (q, id) => [row(button(id(0), `A · ${q.a}`, 1), button(id(1), `B · ${q.b}`, 1))];
const confLabel = (c) => (CONF_WORDS[c] ? `${c}% · ${CONF_WORDS[c]}` : `${c}%`);
const confButtons = (id) => CONF_ROWS.map((levels) => row(...levels.map((c) => button(id(c), confLabel(c)))));
// <url> inside the link keeps Discord from adding a preview card per source.
const source = (url) => (/^https?:\/\//.test(url ?? '') ? ` ([source](<${url.replace(/[<>\s]/g, '')}>))` : '');

function value(v, unit) {
  if (/year/i.test(unit ?? '')) return String(v); // 1903, not 1,903
  const n = typeof v === 'number' ? v.toLocaleString('en-US') : esc(v);
  return unit ? `${n} ${esc(unit)}` : n;
}

// One option with its true value and source, marked when it is the right answer.
// `truth` = {a_value, b_value, unit, a_source, b_source, correct: 0|1}.
function side(q, truth, i) {
  const opt = i === truth.correct ? `✅ **${option(q, i)}**` : option(q, i);
  return `${opt}: ${value(i ? truth.b_value : truth.a_value, truth.unit)}${source(i ? truth.b_source : truth.a_source)}`;
}

// ---- Daily question ------------------------------------------------------------------------------------------

// The day's question in the channel. Button ids carry what an answer needs: date, round, item, choice.
export function questionPost(q, date, revealAt) {
  return {
    content: `**Who's Bluffing?** · ${esc(q.prompt)}\n-# Tap A or B, then say how sure you are. Answer at ${utc(revealAt)}.`,
    components: abButtons(q, (choice) => `q:${date}:${q.round_id}:${q.item_id}:${choice}`),
    allowed_mentions: NO_PINGS,
  };
}

export const confidencePicker = (date, roundId, itemId, choice) => ({
  content: `You picked **${LETTERS[choice]}**. Say how sure you are.`,
  components: confButtons((conf) => `c:${date}:${roundId}:${itemId}:${choice}:${conf}`),
});

// `already`: the API no longer takes changes for that day (409), so the earlier answer stands.
export const lockedIn = (choice, conf, revealAt, already = false) => ({
  content: `${already ? 'Already locked in' : 'Locked in'}: ${LETTERS[choice]} at ${conf}%. Reveal at ${utc(revealAt)}.`,
  components: [],
});

// "Which is longer: the Nile or the Danube?" + a wrong pick of the Danube at 90%:
// "Someone was 90% sure the Danube is longer. It isn't."
export function bluffLine(q, bluff, name) {
  const pick = esc(bluff.choice ? q.b : q.a);
  const m = /^Which (is|was|came) ([^:?]+)/i.exec(q.prompt);
  const verb = m?.[1].toLowerCase();
  const claim = m ? `${pick} ${verb} ${esc(m[2].trim())}. ${NEGATIONS[verb]}` : `it was ${pick}. It wasn't.`;
  return `${name ? esc(name) : 'Someone'} was ${bluff.conf}% sure ${claim}`;
}

// The question post after the reveal: both values with sources, this server's split, top 5 and the bluff line.
export function revealMessage({ q, r, top, names, bluff, roast }) {
  const lines = [`**Who's Bluffing?** · ${esc(q.prompt)}`, side(q, r, 0), side(q, r, 1)];
  if (!r.n) {
    lines.push('Nobody here answered this one.');
  } else {
    lines.push(`${r.n} answered · ${Math.round(r.pct_a)}% A · ${Math.round(r.pct_b)}% B`);
    if (top.length) {
      lines.push(`**Top ${top.length}:** ${top.map((t, i) => `${i + 1}. ${nameOf(names, t.anon_id)} ${signed(t.points)}`).join(' · ')}`);
    }
    if (bluff) lines.push(bluffLine(q, bluff, roast ? names.get(bluff.anon_id) : null));
  }
  return { content: lines.join('\n'), components: [], allowed_mentions: NO_PINGS };
}

export const posted = (revealAt) => `Posted. The answer comes out at ${utc(revealAt)}.`;

export const alreadyPosted = (guildId, post) =>
  post.message_id
    ? `Today's question is already up: https://discord.com/channels/${guildId}/${post.channel_id}/${post.message_id}`
    : "Today's question is being posted right now.";

// ---- Setup, stats, recap -------------------------------------------------------------------------------------

export const channelHello = (hour) => ({
  content: `Who's Bluffing will post a question here every day at ${hourText(hour)}. Tap A or B, then say how sure you are.`,
  allowed_mentions: NO_PINGS,
});

export const setupDone = (s) =>
  `Done. Who's Bluffing posts a question in <#${s.channel_id}> every day at ${hourText(s.post_hour_utc)} and reveals the answer ` +
  `${plural(s.reveal_delay_h, 'hour')} later. Roast mode is ${s.roast ? 'on: the reveal names the biggest bluffer' : 'off: the bluffer stays anonymous'}.`;

export const invite = (url) => `Add Who's Bluffing to a server: ${url}`;

// The 30-day leaderboard and participation.
export function statsMessage(board, names) {
  if (!board.answers) return { content: "No answers in the last 30 days yet. Type /bluff question to post today's question." };
  const head = `**Who's Bluffing, last 30 days:** ${plural(board.players, 'member')} answered ${plural(board.answers, 'time')} on ${plural(board.days, 'day')}.`;
  const lines = board.top.map((r, i) => `${i + 1}. ${nameOf(names, r.anon_id)} — ${plural(r.points, 'point')} from ${plural(r.answers, 'answer')}`);
  return { content: [head, ...lines].join('\n'), allowed_mentions: NO_PINGS };
}

// Smallest gap between average confidence and hit rate, among members with 3+ answers. Ties: more answers, more points.
export function mostCalibrated(members) {
  const gap = (m) => Math.abs(m.mean_conf - (100 * m.hits) / m.n);
  const ranked = members
    .filter((m) => m.n >= MIN_CALIBRATED_ANSWERS)
    .sort((a, b) => gap(a) - gap(b) || b.n - a.n || b.points - a.points || a.anon_id.localeCompare(b.anon_id));
  return ranked[0] ?? null;
}

// Consecutive days with an answer, ending on `lastDay`. `days` is newest first.
export function streak(days, lastDay) {
  let n = 0;
  while (days[n] === addDays(lastDay, -n)) n += 1;
  return n;
}

// Monday's recap of the previous 7 days.
export function recapMessage(week, best, names) {
  const streakText = week.streak ? ` Streak: ${plural(week.streak, 'day')} in a row.` : '';
  const lines = [
    "**Who's Bluffing? · last week in this server**",
    `${plural(week.answers, 'answer')} from ${plural(week.players, 'member')}.${streakText}`,
    ...week.levels.map((l) => `${l.conf}% sure: right ${pct(l.hits, l.n)}% of the time (${plural(l.n, 'answer')})`),
  ];
  if (best) {
    lines.push(`Most calibrated: ${nameOf(names, best.anon_id)}, ${pct(best.hits, best.n)}% right at ${Math.round(best.mean_conf)}% sure.`);
  }
  lines.push(`Bluffs (${BLUFF_CONF}%+ sure and wrong): ${week.bluffs}`);
  return { content: lines.join('\n'), allowed_mentions: NO_PINGS };
}

// ---- /bluff play (private, one message edited in place) ----------------------------------------------------

const progress = (state, step) => `${ROUND} · Question ${step + 1} of ${state.items.length} · ${plural(state.total, 'point')}`;

export function playQuestion(state, step) {
  const it = state.items[step];
  return {
    content: `${progress(state, step)}\n${esc(it.prompt)}`,
    components: abButtons(it, (choice) => `pa:${state.round_id}:${step}:${choice}`),
  };
}

export function playConfidence(state, step, choice) {
  const it = state.items[step];
  return {
    content: `${progress(state, step)}\n${esc(it.prompt)}\nYou picked **${option(it, choice)}**. Say how sure you are.`,
    components: confButtons((conf) => `pc:${state.round_id}:${step}:${choice}:${conf}`),
  };
}

// After a confidence tap: right or wrong, points, both values with sources. `state.total` includes this answer.
export function playResult(state, step, choice, conf, res) {
  const it = state.items[step];
  const truth = { ...res.truth, correct: res.correct ? choice : 1 - choice };
  const last = step + 1 === state.items.length;
  return {
    content: [
      `${ROUND} · Question ${step + 1} of ${state.items.length}`,
      esc(it.prompt),
      `${res.correct ? 'Right' : 'Wrong'} at ${conf}%: **${signed(Math.round(res.points))}** · total ${plural(state.total, 'point')}`,
      side(it, truth, 0),
      side(it, truth, 1),
    ].join('\n'),
    components: [row(button(`pn:${state.round_id}:${step + 1}`, last ? 'See your score' : 'Next', 1))],
  };
}

export function playEnd(done, challengeId) {
  const line = TYPE_LINES[done.type] ? `${done.type}: ${TYPE_LINES[done.type]}.` : `${esc(done.type)}.`;
  const lines = [
    `${ROUND} · **${plural(Math.round(done.score), 'point')}**`,
    `${line} ${Math.round(done.accuracy)}% right at ${Math.round(done.mean_conf)}% sure.`,
  ];
  if (done.roast) lines.push(esc(done.roast));
  if (done.streak > 1) lines.push(`Streak: ${done.streak} days.`);
  const buttons = [button('pp', 'Play again', 1)];
  if (challengeId) buttons.push(button(challengeId, 'Challenge'));
  return { content: lines.join('\n'), components: [row(...buttons)] };
}

// Public, because the player pressed Challenge. Their display name comes from that button press and is not stored.
export const challengePost = (name, score, url) => ({
  content: `${esc(name)} scored ${plural(score, 'point')} in a Who's Bluffing round. Can you beat that? ${url}`,
  allowed_mentions: NO_PINGS,
});
