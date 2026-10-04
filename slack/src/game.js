// Message builders (Slack Block Kit), game rules and all user-facing copy.

export const FAIL_TEXT = 'HowSure is taking a break, try again in a minute.';
export const NOT_INSTALLED = "HowSure isn't installed in this workspace. Please install it again from the Add to Slack link.";
export const CANT_POST = "I can't post in that channel. If it is private, invite me with /invite @HowSure and try again.";
export const CLOSED = 'This question is closed. A new one comes tomorrow.';
export const ALREADY_OUT = "Today's answer is already out. A new question comes tomorrow.";
export const ALREADY_UP = "Today's question is already up in this channel.";
export const NOTHING_TO_REVEAL = "There is no open question to reveal. Type /howsure to post today's question.";
export const USAGE = [
  '*HowSure commands*',
  "`/howsure` post today's question in this channel",
  '`/howsure setup #channel [hour] [roast on|off]` post the question in #channel every day at that hour, in UTC (default 14)',
  '`/howsure setup roast on|off` roast on: the reveal names the biggest bluffer (off by default)',
  '`/howsure reveal` reveal the answer now',
  "`/howsure stats` this workspace's points for the last 30 days",
].join('\n');

export const PICK = 'pick'; // action ids pick:0 (A) and pick:1 (B)
export const CONF = 'conf'; // action ids conf:50 … conf:100
export const LETTERS = ['A', 'B'];
export const CONFS = [50, 60, 70, 80, 90, 100];
const CONF_LABELS = { 50: 'coin flip', 100: 'stake it all' };
export const REVEAL_DELAY_H = 8;
export const BLUFF_CONF = 80; // a bluff = a wrong answer at this confidence or more (reveal line and weekly recap)
export const MIN_CALIBRATED_ANSWERS = 3; // answers in the week needed to be "most calibrated"

const HOUR_MS = 3_600_000;
const BUTTON_TEXT_MAX = 75;

// The reveal is due REVEAL_DELAY_H after the post hour, or after the post itself when it went up later, so a late
// post still gets the full delay. Always on the hour, so the hourly cron meets it exactly.
export function revealAt(date, postHour, postedMs) {
  const scheduled = Date.parse(`${date}T00:00:00Z`) + postHour * HOUR_MS;
  const posted = Math.floor(postedMs / HOUR_MS) * HOUR_MS;
  return Math.max(scheduled, posted) + REVEAL_DELAY_H * HOUR_MS;
}

// Slack mrkdwn needs only these three escaped.
const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const num = (n) => Number(n).toLocaleString('en-US', { maximumFractionDigits: 2 });
const plural = (n, word) => `${n} ${word}${n === 1 ? '' : 's'}`;
const section = (text) => ({ type: 'section', text: { type: 'mrkdwn', text } });
const context = (text) => ({ type: 'context', elements: [{ type: 'mrkdwn', text }] });
const button = (actionId, text, value) => ({ type: 'button', action_id: actionId, text: { type: 'plain_text', text: text.slice(0, BUTTON_TEXT_MAX) }, value });
const nameOf = (names, anonId) => esc(names.get(anonId) ?? 'a teammate');
const hour = (ms) => `${String(new Date(ms).getUTCHours()).padStart(2, '0')}:00 UTC`;
const signed = (p) => (p > 0 ? `+${p}` : String(p));
const percent = (part, whole) => Math.round((100 * part) / whole);
const dayLabel = (iso) => new Date(`${iso}T00:00:00Z`).toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' });
const option = (q, choice) => (choice === 0 ? q.a : q.b);

// The API's prompt may or may not name the two options already.
export function questionText(q) {
  const named = [q.a, q.b].every((s) => q.prompt.toLowerCase().includes(String(s).toLowerCase()));
  return named ? q.prompt : `${q.prompt.replace(/\?\s*$/, '')}: ${q.a} or ${q.b}?`;
}

// The day's channel post. Both buttons carry the round, item and date, so a tap answers the question it shows.
export function questionMessage(q, date, revealMs) {
  const value = JSON.stringify({ r: q.round_id, i: q.item_id, d: date });
  return {
    text: `HowSure · ${questionText(q)}`,
    blocks: [
      section(`*HowSure* · ${esc(questionText(q))}`),
      { type: 'actions', elements: [0, 1].map((c) => button(`${PICK}:${c}`, `${LETTERS[c]} · ${option(q, c)}`, value)) },
      context(`Tap A or B, then say how sure you are. Nobody sees your answer before the reveal at ${hour(revealMs)}.`),
    ],
  };
}

// The private confidence picker. `pick` = {r, i, d, c, t} rides along on every button.
export function pickerMessage(pick, label, existing) {
  const value = JSON.stringify(pick);
  const again = existing ? ` You are locked in at ${LETTERS[existing.choice]}, ${existing.conf}%. Pick again to change it.` : '';
  return {
    text: `You picked ${label}. How sure are you?`,
    blocks: [
      section(`You picked *${esc(label)}*. How sure are you?${again}`),
      { type: 'actions', elements: CONFS.map((c) => button(`${CONF}:${c}`, CONF_LABELS[c] ? `${c}% · ${CONF_LABELS[c]}` : `${c}%`, value)) },
    ],
  };
}

export const lockedIn = (choice, conf, revealMs) => `Locked in: ${LETTERS[choice]} at ${conf}%. Reveal at ${hour(revealMs)}.`;
export const alreadyLockedIn = (a, revealMs) => `You're already locked in: ${LETTERS[a.choice]} at ${a.conf}%. Reveal at ${hour(revealMs)}.`;

export function setupDone({ channel_id: channel, post_hour_utc: postHour, roast }) {
  const where = channel
    ? `HowSure will post the daily question in <#${channel}> every day at ${hour(postHour * HOUR_MS)} and reveal the answer ${REVEAL_DELAY_H} hours later.`
    : 'Choose the channel with /howsure setup #channel.';
  return `Done. ${where} Roast mode is ${roast ? 'on: the reveal names the biggest bluffer' : 'off'}.`;
}

const valueText = (v, unit) => {
  if (typeof v !== 'number') return esc(v ?? '?');
  if (/year/i.test(unit ?? '')) return String(v); // 1903, not "1,903 years"
  return `${num(v)}${unit ? ` ${esc(unit)}` : ''}`;
};
const sourceLink = (src) => (/^https?:\/\//.test(src ?? '') ? ` (<${src.replace(/[<>|]/g, '')}|source>)` : '');

// The reveal replaces the post (buttons gone). `top` = rows to name; `bluff` = {conf, choice, name?} or null.
export function revealMessage(q, r, top, names, bluff) {
  const values = [0, 1].map((c) =>
    `${esc(option(q, c))}: ${valueText(c === 0 ? r.a_value : r.b_value, r.unit)}${sourceLink(c === 0 ? r.a_source : r.b_source)}`);
  const lines = [
    `*HowSure* · ${esc(questionText(q))}`,
    `*Answer: ${LETTERS[r.correct]}, ${esc(option(q, r.correct))}.* ${values.join(' · ')}`,
    r.n ? `${r.n} answered · ${Math.round(r.pct_a)}% A · ${Math.round(r.pct_b)}% B` : 'Nobody answered this one.',
  ];
  if (top.length) lines.push(`*Points:* ${top.map((row, i) => `${i + 1}. ${nameOf(names, row.anon_id)} ${signed(row.points)}`).join(' · ')}`);
  if (bluff) {
    const who = bluff.name ? esc(bluff.name) : 'Someone';
    lines.push(`${who} was ${bluff.conf}% sure it was ${LETTERS[bluff.choice]} (${esc(option(q, bluff.choice))}). It wasn't.`);
  }
  const text = lines.join('\n');
  return { text, blocks: [section(text)] };
}

// The 30-day workspace leaderboard. `rows` = the rows to name.
export function statsMessage(board, rows, names) {
  if (!board.answers) return { text: "No revealed answers in the last 30 days yet. Type /howsure to post today's question." };
  const head = `*HowSure, last 30 days:* ${plural(board.players, 'member')} gave ${plural(board.answers, 'answer')}.`;
  const lines = rows.map((r, i) => `${i + 1}. ${nameOf(names, r.anon_id)} — ${plural(r.points, 'point')} in ${plural(r.answers, 'answer')}`);
  return { text: [head, ...lines].join('\n') };
}

// The Monday recap of the week from `from` to `to`.
export function recapMessage(week, names) {
  const lines = [
    `*HowSure · last week in this workspace* (${dayLabel(week.from)} – ${dayLabel(week.to)})`,
    '*How often each confidence level was right*',
    ...week.levels.map((l) => `${l.conf}% sure: ${l.n_right} of ${l.n} right (${percent(l.n_right, l.n)}%)`),
  ];
  if (week.best) {
    const b = week.best;
    lines.push(`*Most calibrated:* ${nameOf(names, b.anon_id)}, ${Math.round(b.conf)}% sure on average and ${Math.round(b.acc)}% right`);
  }
  lines.push(`*Bluffs* (wrong at ${BLUFF_CONF}% or more): ${week.bluffs}`);
  lines.push(`*Days played:* ${week.days} of 7 · streak: ${plural(week.streak, 'day')}`);
  return { text: lines.join('\n') };
}
