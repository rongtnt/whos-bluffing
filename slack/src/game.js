// Message and modal builders (Slack Block Kit) and all user-facing copy.

export const FAIL_TEXT = 'HowSure is taking a break, try again in a minute.';
export const NOT_INSTALLED = "HowSure isn't installed in this workspace. Please install it again from the Add to Slack link.";
export const CANT_POST = "I can't post in that channel. If it is private, invite me with /invite @HowSure and try again.";
export const USAGE = [
  '*HowSure commands*',
  "`/howsure` post today's game in this channel",
  '`/howsure setup #channel [hour]` post the game in #channel every day at that hour, in UTC (default 14)',
  "`/howsure stats` this workspace's leaderboard for the last 30 days",
].join('\n');
export const PLAY_ACTION = 'play';
export const MODAL_ID = 'howsure_play';

// Slack mrkdwn needs only these three escaped.
const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const num = (n) => (Number.isInteger(n) ? n.toLocaleString('en-US') : String(n));
const plural = (n, word) => `${n} ${word}${n === 1 ? '' : 's'}`;
const section = (text) => ({ type: 'section', text: { type: 'mrkdwn', text } });
const plain = (text) => ({ type: 'plain_text', text });
const nameOf = (names, anonId) => esc(names.get(anonId) ?? 'a teammate');
const square = (r) => (r.hit ? '🟩' : '🟥');

// The day's channel message: game line, Play button, and the workspace board once someone has played.
export function dailyMessage(day, stats, board = null, names = new Map()) {
  const n = day.items.length;
  const avg = stats?.players > 0 ? ` Today's average so far: ${Number(stats.avg_hits).toFixed(1)}/${n}.` : '';
  const text = `HowSure #${day.number} — ${n} questions, give a range you're 90% sure about.${avg}`;
  const blocks = [
    section(esc(text)),
    { type: 'actions', elements: [{ type: 'button', action_id: PLAY_ACTION, style: 'primary', text: plain('Play') }] },
  ];
  if (board?.players > 0) {
    const lines = board.top.map((r, i) => `${i + 1}. ${nameOf(names, r.anon_id)} — ${r.hits}/${n}`);
    const head = `*Today in this workspace:* ${plural(board.players, 'player')}, average ${board.avg.toFixed(1)}/${n}`;
    blocks.push(section([head, ...lines].join('\n')));
  }
  return { text, blocks };
}

export const inputId = (itemId, side) => `${itemId}:${side}`;

const numberInput = (itemId, side, label) => ({
  type: 'input',
  block_id: inputId(itemId, side),
  label: plain(label),
  element: { type: 'number_input', action_id: 'v', is_decimal_allowed: true },
});

// The play modal: each question is a prompt with its unit, then a low and a high number.
export function playModal(day, meta) {
  const blocks = [section('Give a low and a high number for each question so that you are 90% sure the true answer is in between.')];
  day.items.forEach((it, i) => {
    const unit = it.unit ? ` (${it.unit})` : '';
    blocks.push(section(`*${i + 1}. ${esc(it.prompt)}*${esc(unit)}`));
    blocks.push(numberInput(it.id, 'lo', `Low${unit}`), numberInput(it.id, 'hi', `High${unit}`));
  });
  return {
    type: 'modal',
    callback_id: MODAL_ID,
    title: plain(`HowSure #${day.number}`),
    submit: plain('Submit'),
    close: plain('Cancel'),
    private_metadata: JSON.stringify(meta),
    blocks,
  };
}

const toNumber = (s) => (s == null || String(s).trim() === '' ? NaN : Number(s));

// Reads the modal state. Returns {values: Map(itemId -> {low, high})} or {errors: {block_id: message}}.
export function readAnswers(stateValues) {
  const values = new Map();
  const errors = {};
  for (const key of Object.keys(stateValues)) {
    if (!key.endsWith(':lo')) continue;
    const itemId = key.slice(0, -3);
    const low = toNumber(stateValues[key]?.v?.value);
    const high = toNumber(stateValues[inputId(itemId, 'hi')]?.v?.value);
    if (!Number.isFinite(low)) errors[key] = 'Enter a number.';
    else if (!Number.isFinite(high)) errors[inputId(itemId, 'hi')] = 'Enter a number.';
    else if (low > high) errors[inputId(itemId, 'hi')] = 'High must be at least as large as low.';
    else values.set(itemId, { low, high });
  }
  return Object.keys(errors).length ? { errors } : { values };
}

const sourceLink = (src) => (/^https?:\/\//.test(src ?? '') ? `<${src.replace(/[<>|]/g, '')}|source>` : esc(src ?? ''));

// The private result: grid, score, and each truth with its source. results[i] answers day.items[i].
export function resultMessage(day, results, again = false) {
  const hits = results.filter((r) => r.hit).length;
  const text = `${again ? 'You already played today. ' : ''}HowSure #${day.number} ${results.map(square).join('')} ${hits}/${results.length} at 90%`;
  const lines = day.items.map((it, i) => {
    const r = results[i];
    const unit = it.unit ? ` ${esc(it.unit)}` : '';
    return `${square(r)} ${esc(it.prompt)} *${esc(num(r.truth))}${unit}* · ${sourceLink(r.source)}`;
  });
  return { text, blocks: [section([`*${esc(text)}*`, ...lines].join('\n'))] };
}

// The 30-day workspace leaderboard.
export function statsMessage(board, names = new Map()) {
  if (!board.plays) return { text: "No plays in the last 30 days yet. Type /howsure to post today's game." };
  const head = `*HowSure, last 30 days:* ${plural(board.players, 'member')} played ${plural(board.plays, 'game')}.`;
  const lines = board.top.map((r, i) => `${i + 1}. ${nameOf(names, r.anon_id)} — ${plural(r.hits, 'hit')} in ${plural(r.plays, 'play')}`);
  return { text: [head, ...lines].join('\n') };
}
