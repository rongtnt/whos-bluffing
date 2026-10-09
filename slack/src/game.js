// Message builders (Slack Block Kit), game rules and all user-facing copy.

export const FAIL_TEXT = "Who's Bluffing is taking a break, try again in a minute.";
export const NOT_INSTALLED = "Who's Bluffing isn't installed in this workspace. Please install it again from the Add to Slack link.";
export const CANT_POST = "I can't post in that channel. If it is private, invite me with /invite @whosbluffing and try again.";
export const CLOSED = 'This question is closed. A new one comes tomorrow.';
export const ALREADY_OUT = "Today's answer is already out. A new question comes tomorrow.";
export const ALREADY_UP = "Today's question is already up in this channel.";
export const NOTHING_TO_REVEAL = "There is no open question to reveal. Type /bluff question to post today's question.";
export const USAGE = [
  "*Who's Bluffing? commands*",
  '`/bluff` open the private Play solo / Play with friends menu',
  '`/bluff party` choose a topic and difficulty, then invite friends to the same ten questions',
  '`/bluff play` choose a topic and difficulty for a private ten-question round',
  "`/bluff question` post today's question in this channel",
  '`/bluff setup #channel [hour] [roast on|off] [reveal N]` post the question in #channel every day at that hour in your time zone ' +
    '(14:00 UTC if left out; add utc after the hour for UTC) and reveal the answer N hours later (2 to 23, default 8)',
  '`/bluff setup roast on|off` roast on: the reveal names the biggest bluffer (off by default)',
  '`/bluff reveal` reveal the answer now',
  "`/bluff stats` this workspace's points for the last 30 days",
].join('\n');

export const PICK = 'pick'; // action ids pick:0 (A) and pick:1 (B)
export const CONF = 'conf'; // action ids conf:50 … conf:100
export const LETTERS = ['A', 'B'];
export const CONFS = [50, 60, 70, 80, 90, 100];
const CONF_LABELS = { 50: 'coin flip', 100: 'stake it all' };
export const REVEAL_DELAY_H = 8; // when the workspace never set `reveal N`
// `reveal N` bounds. 23 at most keeps every reveal inside the API's answer window (the question's day or the next).
export const MIN_REVEAL_H = 2;
export const MAX_REVEAL_H = 23;
export const BLUFF_CONF = 80; // a bluff = a wrong answer at this confidence or more (reveal line and weekly recap)
export const MIN_CALIBRATED_ANSWERS = 3; // answers in the week needed to be "most calibrated"

const HOUR_MS = 3_600_000;
const DAY_MS = 86_400_000;
const DAY_S = 86_400;
const BUTTON_TEXT_MAX = 75;

// The reveal is due `delayH` hours (REVEAL_DELAY_H when null) after the post hour, or after the post itself when it
// went up later, so a late post still gets the full delay. Always on the hour, so the hourly cron meets it exactly.
export function revealAt(date, postHour, postedMs, delayH) {
  const scheduled = Date.parse(`${date}T00:00:00Z`) + postHour * HOUR_MS;
  const posted = Math.floor(postedMs / HOUR_MS) * HOUR_MS;
  return Math.max(scheduled, posted) + (delayH ?? REVEAL_DELAY_H) * HOUR_MS;
}

const mod = (n, m) => ((n % m) + m) % m;
const pad = (n) => String(n).padStart(2, '0');

// The UTC hour for `hour` o'clock at `tzOffset` seconds east of UTC (users.info's tz_offset). Zones a half or quarter
// hour off round down to the full UTC hour, since the cron runs on the hour.
export const toUtcHour = (hour, tzOffset) => Math.floor(mod(hour * 3600 - tzOffset, DAY_S) / 3600);

// The member's own clock time (HH:MM) for the UTC hour `utcHour`.
export function localClock(utcHour, tzOffset) {
  const s = mod(utcHour * 3600 + tzOffset, DAY_S);
  return `${pad(Math.floor(s / 3600))}:${pad(Math.floor((s % 3600) / 60))}`;
}

// Slack mrkdwn needs only these three escaped.
const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const num = (n) => Number(n).toLocaleString('en-US', { maximumFractionDigits: 2 });
const plural = (n, word) => `${n} ${word}${n === 1 ? '' : 's'}`;
const section = (text) => ({ type: 'section', text: { type: 'mrkdwn', text } });
const context = (text) => ({ type: 'context', elements: [{ type: 'mrkdwn', text }] });
const button = (actionId, text, value) => ({ type: 'button', action_id: actionId, text: { type: 'plain_text', text: text.slice(0, BUTTON_TEXT_MAX) }, value });
const nameOf = (names, anonId) => esc(names.get(anonId) ?? 'a teammate');
const signed = (p) => (p > 0 ? `+${p}` : String(p));
const percent = (part, whole) => Math.round((100 * part) / whole);
const dayLabel = (iso) => new Date(`${iso}T00:00:00Z`).toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' });
const option = (q, choice) => (choice === 0 ? q.a : q.b);

// Slack date tokens render in each reader's own time zone; the UTC fallback shows where a client cannot render them.
const slackDate = (ms, format, fallback) => `<!date^${Math.floor(ms / 1000)}^${format}|${fallback}>`;
const utcClock = (ms) => new Date(ms).toISOString().slice(11, 16);
const clock = (ms) => slackDate(ms, '{time}', `${utcClock(ms)} UTC`);
// For the reveal, which is often on the next day: "today 10:00 PM", "tomorrow 4:00 AM".
const when = (ms) => slackDate(ms, '{date_short_pretty} {time}', `${dayLabel(new Date(ms).toISOString().slice(0, 10))} ${utcClock(ms)} UTC`);
// Today's `hour` o'clock UTC: a real date, so each reader's clock shows the zone's current offset (DST included).
const todayAt = (hour, now) => Math.floor(now / DAY_MS) * DAY_MS + hour * HOUR_MS;

// The API's prompt may or may not name the two options already.
export function questionText(q) {
  const named = [q.a, q.b].every((s) => q.prompt.toLowerCase().includes(String(s).toLowerCase()));
  return named ? q.prompt : `${q.prompt.replace(/\?\s*$/, '')}: ${q.a} or ${q.b}?`;
}

// The day's channel post. Both buttons carry the round, item and date, so a tap answers the question it shows.
export function questionMessage(q, date, revealMs) {
  const value = JSON.stringify({ r: q.round_id, i: q.item_id, d: date });
  return {
    text: `Who's Bluffing? · ${questionText(q)}`,
    blocks: [
      section(`*Who's Bluffing?* · ${esc(questionText(q))}`),
      { type: 'actions', elements: [0, 1].map((c) => button(`${PICK}:${c}`, `${LETTERS[c]} · ${option(q, c)}`, value)) },
      context(`Tap A or B, then say how sure you are. Nobody sees your answer before the reveal: ${when(revealMs)}.`),
    ],
  };
}

// The private confidence picker. `pick` = {r, i, d, c, t} rides along on every button.
export function pickerMessage(pick, label, existing) {
  const value = JSON.stringify(pick);
  const again = existing ? ` You are locked in at ${LETTERS[existing.choice]}, ${existing.conf}%. Pick again to change it.` : '';
  return {
    text: `You picked ${label}. Say how sure you are.`,
    blocks: [
      section(`You picked *${esc(label)}*. Say how sure you are.${again}`),
      { type: 'actions', elements: CONFS.map((c) => button(`${CONF}:${c}`, CONF_LABELS[c] ? `${c}% · ${CONF_LABELS[c]}` : `${c}%`, value)) },
    ],
  };
}

export const lockedIn = (choice, conf, revealMs) => `Locked in: ${LETTERS[choice]} at ${conf}%. Reveal: ${when(revealMs)}.`;
export const alreadyLockedIn = (a, revealMs) => `You're already locked in: ${LETTERS[a.choice]} at ${a.conf}%. Reveal: ${when(revealMs)}.`;

// `tzOffset`: the member's zone (seconds east of UTC) when the hour they typed was read in it, else null.
// `noZone`: they typed an hour, but Slack did not say their zone, so it was read as UTC.
export function setupDone(install, { tzOffset = null, noZone = false, now }) {
  const { channel_id: channel, post_hour_utc: postHour, reveal_delay_h: delay, roast } = install;
  const utc = `${pad(postHour)}:00 UTC`;
  const at = tzOffset === null
    ? `${utc} (${clock(todayAt(postHour, now))} your time)`
    : `${localClock(postHour, tzOffset)} your time (${utc})`;
  const where = channel
    ? `Who's Bluffing will post the daily question in <#${channel}> every day at ${at} and reveal the answer ` +
      `${plural(delay ?? REVEAL_DELAY_H, 'hour')} later (change it with reveal N, ${MIN_REVEAL_H} to ${MAX_REVEAL_H}).`
    : 'Choose the channel with /bluff setup #channel.';
  const zone = noZone ? " I couldn't read your time zone from Slack, so the hour is in UTC." : '';
  return `Done.${zone} ${where} Roast mode is ${roast ? 'on: the reveal names the biggest bluffer' : 'off'}.`;
}

// The command list, plus this workspace's schedule (in each reader's own time) once it has a channel.
export const usage = (install, now) => (install?.channel_id
  ? `${USAGE}\nThis workspace: a question in <#${install.channel_id}> every day at ${clock(todayAt(install.post_hour_utc, now))}, ` +
    `the answer ${plural(install.reveal_delay_h ?? REVEAL_DELAY_H, 'hour')} later.`
  : USAGE);

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
    `*Who's Bluffing?* · ${esc(questionText(q))}`,
    `*Answer: ${LETTERS[r.correct]}, ${esc(option(q, r.correct))}.* ${values.join(' · ')}`,
    r.n ? `${r.n} answered · ${Math.round(r.pct_a)}% A · ${Math.round(r.pct_b)}% B` : 'Nobody answered this one.',
  ];
  if (top.length) lines.push(`*Points:* ${top.map((row, i) => `${i + 1}. ${nameOf(names, row.anon_id)} ${signed(row.points)}`).join(' · ')}`);
  if (bluff) {
    const who = bluff.name ? esc(bluff.name) : 'Someone';
    lines.push(`${who} was ${bluff.conf}% sure it was ${LETTERS[bluff.choice]} (${esc(option(q, bluff.choice))}). It wasn't.`);
  }
  const text = lines.join('\n');
  // The install loop that carried Truth or Dare (docs/TOD_TRACTION.md): every reveal says where to get the app.
  return { text, blocks: [section(text), context('Add Who\u2019s Bluffing to another workspace: <https://whosbluffing.com/slack|whosbluffing.com/slack>')] };
}

// The 30-day workspace leaderboard. `rows` = the rows to name.
export function statsMessage(board, rows, names) {
  if (!board.answers) return { text: "No revealed answers in the last 30 days yet. Type /bluff question to post today's question." };
  const head = `*Who's Bluffing, last 30 days:* ${plural(board.players, 'member')} gave ${plural(board.answers, 'answer')}.`;
  const lines = rows.map((r, i) => `${i + 1}. ${nameOf(names, r.anon_id)} — ${plural(r.points, 'point')} in ${plural(r.answers, 'answer')}`);
  return { text: [head, ...lines].join('\n') };
}

// The Monday recap of the week from `from` to `to`.
export function recapMessage(week, names) {
  const lines = [
    `*Who's Bluffing? · last week in this workspace* (${dayLabel(week.from)} – ${dayLabel(week.to)})`,
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
