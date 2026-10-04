// D1 access. Stored: team id, bot token, channel id, post hour, roast setting, the last recap week, per-day posts
// (channel, ts, revealed) and per-day answers (choice, conf, correct, points) keyed by the salted member hash.
// Never message text, names, emails or raw member ids.

import { BLUFF_CONF, MIN_CALIBRATED_ANSWERS } from './game.js';

export const DEFAULT_HOUR = 14;

export const getInstall = (db, teamId) =>
  db.prepare('SELECT * FROM installs WHERE team_id = ?').bind(teamId).first();

// A reinstall replaces the token and keeps the channel, hour and roast setting.
export const saveInstall = (db, teamId, botToken, now) =>
  db.prepare(
    `INSERT INTO installs (team_id, bot_token, post_hour_utc, installed_at) VALUES (?, ?, ?, ?)
     ON CONFLICT(team_id) DO UPDATE SET bot_token = excluded.bot_token, installed_at = excluded.installed_at`,
  ).bind(teamId, botToken, DEFAULT_HOUR, now).run();

// Null fields keep their stored value.
export const setup = (db, teamId, { channel = null, hour = null, roast = null }) =>
  db.prepare(
    `UPDATE installs SET channel_id = COALESCE(?, channel_id), post_hour_utc = COALESCE(?, post_hour_utc),
     roast = COALESCE(?, roast) WHERE team_id = ?`,
  ).bind(channel, hour, roast, teamId).run();

export const deleteInstall = (db, teamId) => db.prepare('DELETE FROM installs WHERE team_id = ?').bind(teamId).run();

// Installs with a channel whose post hour has come and that have no post for `date` yet.
export async function dueInstalls(db, date, hour) {
  const { results } = await db.prepare(
    `SELECT * FROM installs i WHERE i.channel_id IS NOT NULL AND i.post_hour_utc <= ?
     AND NOT EXISTS (SELECT 1 FROM posts p WHERE p.team_id = i.team_id AND p.date = ?)`,
  ).bind(hour, date).all();
  return results;
}

export const getPost = (db, teamId, date) =>
  db.prepare('SELECT date, channel_id, ts, revealed FROM posts WHERE team_id = ? AND date = ?').bind(teamId, date).first();

// Records the day's post unless one exists. Returns true when this call created the row (the cron's claim).
export async function claimPost(db, teamId, date, channel, ts = null) {
  const res = await db.prepare('INSERT OR IGNORE INTO posts (team_id, date, channel_id, ts) VALUES (?, ?, ?, ?)')
    .bind(teamId, date, channel, ts).run();
  return res.meta.changes === 1;
}

export const setPost = (db, teamId, date, channel, ts) =>
  db.prepare(
    `INSERT INTO posts (team_id, date, channel_id, ts) VALUES (?, ?, ?, ?)
     ON CONFLICT(team_id, date) DO UPDATE SET channel_id = excluded.channel_id, ts = excluded.ts`,
  ).bind(teamId, date, channel, ts).run();

// Releases a claim whose post failed, so the next hourly run retries.
export const dropClaim = (db, teamId, date) =>
  db.prepare('DELETE FROM posts WHERE team_id = ? AND date = ? AND ts IS NULL').bind(teamId, date).run();

// Posted, unrevealed questions from `since` on (one team, or all when teamId is null), newest first, with what the
// reveal needs from the install.
export async function openPosts(db, since, teamId = null) {
  const { results } = await db.prepare(
    `SELECT p.team_id, p.date, p.channel_id, p.ts, i.bot_token, i.post_hour_utc, i.roast
     FROM posts p JOIN installs i ON i.team_id = p.team_id
     WHERE p.revealed = 0 AND p.ts IS NOT NULL AND p.channel_id IS NOT NULL AND p.date >= ?
     AND p.team_id = COALESCE(?, p.team_id) ORDER BY p.date DESC`,
  ).bind(since, teamId).all();
  return results;
}

// Marks the day revealed. Returns true for exactly one caller, so a post is revealed once.
export async function claimReveal(db, teamId, date) {
  const res = await db.prepare('UPDATE posts SET revealed = 1 WHERE team_id = ? AND date = ? AND revealed = 0').bind(teamId, date).run();
  return res.meta.changes === 1;
}

export const dropReveal = (db, teamId, date) =>
  db.prepare('UPDATE posts SET revealed = 0 WHERE team_id = ? AND date = ?').bind(teamId, date).run();

export const getAnswer = (db, teamId, anonId, date) =>
  db.prepare('SELECT choice, conf FROM answers WHERE team_id = ? AND date = ? AND anon_id = ?').bind(teamId, date, anonId).first();

// Last answer wins.
export const saveAnswer = (db, teamId, anonId, date, { choice, conf, correct, points }) =>
  db.prepare(
    `INSERT INTO answers (team_id, anon_id, date, choice, conf, correct, points) VALUES (?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(team_id, date, anon_id) DO UPDATE SET
       choice = excluded.choice, conf = excluded.conf, correct = excluded.correct, points = excluded.points`,
  ).bind(teamId, anonId, date, choice, conf, correct, points).run();

// The day's top 5 by points (for the reveal).
export async function dayTop(db, teamId, date) {
  const { results } = await db.prepare(
    'SELECT anon_id, points FROM answers WHERE team_id = ? AND date = ? ORDER BY points DESC, anon_id LIMIT 5',
  ).bind(teamId, date).all();
  return results;
}

// Only revealed days count anywhere outside the reveal: earlier, points would give the answer away.
const REVEALED = 'FROM answers a JOIN posts p ON p.team_id = a.team_id AND p.date = a.date AND p.revealed = 1 WHERE a.team_id = ?';

// Board since `since` (inclusive): distinct members, answers, top 10 by total points, ties by more answers.
export async function periodBoard(db, teamId, since) {
  const [agg, top] = await db.batch([
    db.prepare(`SELECT COUNT(DISTINCT a.anon_id) AS players, COUNT(*) AS answers ${REVEALED} AND a.date >= ?`).bind(teamId, since),
    db.prepare(
      `SELECT a.anon_id, SUM(a.points) AS points, COUNT(*) AS answers ${REVEALED} AND a.date >= ?
       GROUP BY a.anon_id ORDER BY points DESC, answers DESC, a.anon_id LIMIT 10`,
    ).bind(teamId, since),
  ]);
  return { ...agg.results[0], top: top.results };
}

// The weekly recap from `from` to `to` (inclusive): right answers per confidence level; the most calibrated member
// (smallest gap between mean confidence and accuracy, with enough answers; ties: more answers, more points);
// answers, days played and bluffs.
export async function weekStats(db, teamId, from, to) {
  const span = `${REVEALED} AND a.date BETWEEN ? AND ?`;
  const [levels, best, totals] = await db.batch([
    db.prepare(`SELECT a.conf, COUNT(*) AS n, SUM(a.correct) AS n_right ${span} GROUP BY a.conf ORDER BY a.conf DESC`)
      .bind(teamId, from, to),
    db.prepare(
      `SELECT a.anon_id, AVG(a.conf) AS conf, 100.0 * AVG(a.correct) AS acc ${span}
       GROUP BY a.anon_id HAVING COUNT(*) >= ?
       ORDER BY ABS(AVG(a.conf) - 100.0 * AVG(a.correct)), COUNT(*) DESC, SUM(a.points) DESC, a.anon_id LIMIT 1`,
    ).bind(teamId, from, to, MIN_CALIBRATED_ANSWERS),
    db.prepare(
      `SELECT COUNT(*) AS answers, COUNT(DISTINCT a.date) AS days, COALESCE(SUM(a.correct = 0 AND a.conf >= ?), 0) AS bluffs ${span}`,
    ).bind(BLUFF_CONF, teamId, from, to),
  ]);
  return { levels: levels.results, best: best.results[0] ?? null, ...totals.results[0] };
}

// Revealed days with at least one answer from `from` to `to` (inclusive), newest first (for the streak).
export async function playedDates(db, teamId, from, to) {
  const { results } = await db.prepare(
    `SELECT DISTINCT a.date ${REVEALED} AND a.date BETWEEN ? AND ? ORDER BY a.date DESC`,
  ).bind(teamId, from, to).all();
  return results.map((r) => r.date);
}

// Installs with a channel whose post hour has come and that have no recap for the week starting `monday` yet.
export async function recapDue(db, monday, hour) {
  const { results } = await db.prepare(
    `SELECT * FROM installs WHERE channel_id IS NOT NULL AND post_hour_utc <= ?
     AND (recap_week IS NULL OR recap_week <> ?)`,
  ).bind(hour, monday).all();
  return results;
}

export async function claimRecap(db, teamId, monday) {
  const res = await db.prepare('UPDATE installs SET recap_week = ? WHERE team_id = ? AND (recap_week IS NULL OR recap_week <> ?)')
    .bind(monday, teamId, monday).run();
  return res.meta.changes === 1;
}

export const dropRecap = (db, teamId, monday) =>
  db.prepare('UPDATE installs SET recap_week = NULL WHERE team_id = ? AND recap_week = ?').bind(teamId, monday).run();
