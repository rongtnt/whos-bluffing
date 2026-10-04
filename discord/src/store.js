// D1 access. Stored: server id, channel id, post hour, reveal delay, roast flag, the bot's own posts (message id and
// the day's question as the API served it), and per-day answers keyed by the salted member hash.
// Never member messages, names or raw member ids.

const changedOne = (res) => res.meta.changes === 1;

export const getInstall = (db, guildId) => db.prepare('SELECT * FROM installs WHERE guild_id = ?').bind(guildId).first();

// Discord sends no install callback, so a server's row is created the first time it uses a command.
export async function ensureInstall(db, guildId, now) {
  await db.prepare('INSERT OR IGNORE INTO installs (guild_id, installed_at) VALUES (?, ?)').bind(guildId, now).run();
  return getInstall(db, guildId);
}

export const saveSetup = (db, guildId, { channel_id: channel, post_hour_utc: hour, roast }) =>
  db.prepare('UPDATE installs SET channel_id = ?, post_hour_utc = ?, roast = ? WHERE guild_id = ?')
    .bind(channel, hour, roast, guildId).run();

export const clearChannel = (db, guildId) =>
  db.prepare('UPDATE installs SET channel_id = NULL WHERE guild_id = ?').bind(guildId).run();

// Servers with a channel whose post hour has come and that have no post for `date` yet.
export async function dueInstalls(db, date, hour) {
  const { results } = await db.prepare(
    `SELECT * FROM installs i WHERE i.channel_id IS NOT NULL AND i.post_hour_utc <= ?
     AND NOT EXISTS (SELECT 1 FROM posts p WHERE p.guild_id = i.guild_id AND p.date = ?)`,
  ).bind(hour, date).all();
  return results;
}

// Servers with a channel whose post hour has come and no recap on `date` yet.
export async function recapInstalls(db, date, hour) {
  const { results } = await db.prepare(
    `SELECT * FROM installs WHERE channel_id IS NOT NULL AND post_hour_utc <= ? AND (last_recap IS NULL OR last_recap < ?)`,
  ).bind(hour, date).all();
  return results;
}

// True when this call took the week's recap (a repeated trigger gets false).
export async function claimRecap(db, guildId, date) {
  return changedOne(await db.prepare(
    'UPDATE installs SET last_recap = ? WHERE guild_id = ? AND (last_recap IS NULL OR last_recap < ?)',
  ).bind(date, guildId, date).run());
}

export const getPost = (db, guildId, date) =>
  db.prepare('SELECT * FROM posts WHERE guild_id = ? AND date = ?').bind(guildId, date).first();

// Records the day's post and its question unless one exists. True when this call created the row (the claim).
export async function claimPost(db, guildId, date, channelId, revealAt, q) {
  return changedOne(await db.prepare(
    'INSERT OR IGNORE INTO posts (guild_id, date, channel_id, reveal_at, prompt, a, b) VALUES (?, ?, ?, ?, ?, ?, ?)',
  ).bind(guildId, date, channelId, revealAt, q.prompt, q.a, q.b).run());
}

export const setPostMessage = (db, guildId, date, messageId) =>
  db.prepare('UPDATE posts SET message_id = ? WHERE guild_id = ? AND date = ?').bind(messageId, guildId, date).run();

// Releases a claim whose post failed, so the next hourly run retries.
export const dropClaim = (db, guildId, date) =>
  db.prepare('DELETE FROM posts WHERE guild_id = ? AND date = ? AND message_id IS NULL').bind(guildId, date).run();

const POST_WITH_ROAST = 'SELECT p.*, i.roast FROM posts p JOIN installs i ON i.guild_id = p.guild_id';

// Posted, unrevealed questions whose reveal time has come, with each server's roast flag.
export async function duePosts(db, nowIso) {
  const { results } = await db.prepare(
    `${POST_WITH_ROAST} WHERE p.revealed = 0 AND p.message_id IS NOT NULL AND p.reveal_at <= ?`,
  ).bind(nowIso).all();
  return results;
}

// The server's newest posted question that is not revealed yet.
export const openPost = (db, guildId) =>
  db.prepare(`${POST_WITH_ROAST} WHERE p.guild_id = ? AND p.revealed = 0 AND p.message_id IS NOT NULL ORDER BY p.date DESC LIMIT 1`)
    .bind(guildId).first();

// True when this call took the reveal, so the cron and /bluff reveal never both reveal.
export async function claimReveal(db, guildId, date) {
  return changedOne(await db.prepare('UPDATE posts SET revealed = 1 WHERE guild_id = ? AND date = ? AND revealed = 0')
    .bind(guildId, date).run());
}

export const releaseReveal = (db, guildId, date) =>
  db.prepare('UPDATE posts SET revealed = 0 WHERE guild_id = ? AND date = ?').bind(guildId, date).run();

export const getAnswer = (db, guildId, date, anonId) =>
  db.prepare('SELECT * FROM answers WHERE guild_id = ? AND date = ? AND anon_id = ?').bind(guildId, date, anonId).first();

// A change of mind before the reveal replaces the member's answer. Points and right/wrong stay NULL until the
// reveal: the API answers daily questions with {locked: true, points_pending: true}.
export const saveAnswer = (db, a) =>
  db.prepare(
    `INSERT INTO answers (guild_id, anon_id, date, choice, conf) VALUES (?, ?, ?, ?, ?)
     ON CONFLICT(guild_id, date, anon_id) DO UPDATE SET choice = excluded.choice, conf = excluded.conf`,
  ).bind(a.guild_id, a.anon_id, a.date, a.choice, a.conf).run();

// At the reveal: right/wrong from the revealed answer, and points by the contract's rule 100 - 400(c - y)^2
// (c = conf / 100, y = 1 when right). Running it twice gives the same result.
export const settleAnswers = (db, guildId, date, correctChoice) =>
  db.prepare(
    `UPDATE answers SET correct = (choice = ?),
       points = CAST(ROUND(100 - 400 * (conf / 100.0 - (choice = ?)) * (conf / 100.0 - (choice = ?))) AS INTEGER)
     WHERE guild_id = ? AND date = ?`,
  ).bind(correctChoice, correctChoice, correctChoice, guildId, date).run();

// One day's top 5 by points, positive scores only: a bluffer's named negative score next to the anonymous
// bluff line would give them away when roast mode is off.
export async function dayTop(db, guildId, date) {
  const { results } = await db.prepare(
    'SELECT anon_id, points FROM answers WHERE guild_id = ? AND date = ? AND points > 0 ORDER BY points DESC, anon_id LIMIT 5',
  ).bind(guildId, date).all();
  return results;
}

// Revealed answers since `since` (inclusive): members, answers, days, top 10 by points (ties: more answers first).
export async function periodBoard(db, guildId, since) {
  const where = 'FROM answers WHERE guild_id = ? AND date >= ? AND points IS NOT NULL';
  const [agg, top] = await db.batch([
    db.prepare(`SELECT COUNT(DISTINCT anon_id) AS players, COUNT(*) AS answers, COUNT(DISTINCT date) AS days ${where}`)
      .bind(guildId, since),
    db.prepare(
      `SELECT anon_id, SUM(points) AS points, COUNT(*) AS answers ${where}
       GROUP BY anon_id ORDER BY points DESC, answers DESC, anon_id LIMIT 10`,
    ).bind(guildId, since),
  ]);
  return { ...agg.results[0], top: top.results };
}

// Revealed answers from `from` to `to` (inclusive): per confidence level, per member, and wrong ones at `bluffConf`+.
export async function weekStats(db, guildId, from, to, bluffConf) {
  const where = 'FROM answers WHERE guild_id = ? AND date BETWEEN ? AND ? AND correct IS NOT NULL';
  const [levels, members, bluffs] = await db.batch([
    db.prepare(`SELECT conf, COUNT(*) AS n, SUM(correct) AS hits ${where} GROUP BY conf ORDER BY conf`).bind(guildId, from, to),
    db.prepare(
      `SELECT anon_id, COUNT(*) AS n, SUM(correct) AS hits, AVG(conf) AS mean_conf, SUM(points) AS points ${where} GROUP BY anon_id`,
    ).bind(guildId, from, to),
    db.prepare(`SELECT COUNT(*) AS n ${where} AND correct = 0 AND conf >= ?`).bind(guildId, from, to, bluffConf),
  ]);
  return {
    levels: levels.results,
    members: members.results,
    bluffs: bluffs.results[0].n,
    answers: levels.results.reduce((sum, l) => sum + l.n, 0),
    players: members.results.length,
  };
}

// Days from `from` to `to` (inclusive) with at least one answer, revealed or not, newest first (for the streak).
export async function answerDays(db, guildId, from, to) {
  const { results } = await db.prepare('SELECT DISTINCT date FROM answers WHERE guild_id = ? AND date BETWEEN ? AND ? ORDER BY date DESC')
    .bind(guildId, from, to).all();
  return results.map((r) => r.date);
}

// ---- /bluff play ------------------------------------------------------------------------------------------

export async function getPlay(db, anonId) {
  const row = await db.prepare('SELECT * FROM play_state WHERE anon_id = ?').bind(anonId).first();
  return row && { ...row, items: JSON.parse(row.items) };
}

// A new round replaces the member's old one.
export const startPlay = (db, anonId, roundId, items, now) =>
  db.prepare(
    `INSERT INTO play_state (anon_id, round_id, items, step, total, updated_at) VALUES (?, ?, ?, 0, 0, ?)
     ON CONFLICT(anon_id) DO UPDATE SET round_id = excluded.round_id, items = excluded.items, step = 0, total = 0,
       updated_at = excluded.updated_at`,
  ).bind(anonId, roundId, JSON.stringify(items), now).run();

// Moves the round from step `from` to `to`. False when another tap moved it first.
export async function advancePlay(db, anonId, roundId, from, to, total) {
  return changedOne(await db.prepare(
    'UPDATE play_state SET step = ?, total = ? WHERE anon_id = ? AND round_id = ? AND step = ?',
  ).bind(to, total, anonId, roundId, from).run());
}

export const touchPlay = (db, anonId, now) =>
  db.prepare('UPDATE play_state SET updated_at = ? WHERE anon_id = ?').bind(now, anonId).run();

export const endPlay = (db, anonId) => db.prepare('DELETE FROM play_state WHERE anon_id = ?').bind(anonId).run();
