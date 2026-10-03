// D1 access. Stored: team id, bot token, channel id, post hour, post timestamps, and per-day hits keyed by the
// salted member hash. Never message text, names, emails or raw member ids.

export const DEFAULT_HOUR = 14;

export const getInstall = (db, teamId) =>
  db.prepare('SELECT * FROM installs WHERE team_id = ?').bind(teamId).first();

// A reinstall replaces the token and keeps the channel and hour.
export const saveInstall = (db, teamId, botToken, now) =>
  db.prepare(
    `INSERT INTO installs (team_id, bot_token, post_hour_utc, installed_at) VALUES (?, ?, ?, ?)
     ON CONFLICT(team_id) DO UPDATE SET bot_token = excluded.bot_token, installed_at = excluded.installed_at`,
  ).bind(teamId, botToken, DEFAULT_HOUR, now).run();

export const setChannel = (db, teamId, channelId, hour) =>
  db.prepare('UPDATE installs SET channel_id = ?, post_hour_utc = ? WHERE team_id = ?').bind(channelId, hour, teamId).run();

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
  db.prepare('SELECT ts FROM posts WHERE team_id = ? AND date = ?').bind(teamId, date).first();

// Records today's post unless one exists. Returns true when this call created the row (the cron's claim).
export async function claimPost(db, teamId, date, ts = null) {
  const res = await db.prepare('INSERT OR IGNORE INTO posts (team_id, date, ts) VALUES (?, ?, ?)').bind(teamId, date, ts).run();
  return res.meta.changes === 1;
}

export const setPost = (db, teamId, date, ts) =>
  db.prepare(
    'INSERT INTO posts (team_id, date, ts) VALUES (?, ?, ?) ON CONFLICT(team_id, date) DO UPDATE SET ts = excluded.ts',
  ).bind(teamId, date, ts).run();

// Releases a claim whose post failed, so the next hourly run retries.
export const dropClaim = (db, teamId, date) =>
  db.prepare('DELETE FROM posts WHERE team_id = ? AND date = ? AND ts IS NULL').bind(teamId, date).run();

export const getScore = (db, teamId, anonId, date) =>
  db.prepare('SELECT hits FROM scores WHERE team_id = ? AND date = ? AND anon_id = ?').bind(teamId, date, anonId).first();

export const addScore = (db, teamId, anonId, date, hits) =>
  db.prepare('INSERT OR IGNORE INTO scores (team_id, anon_id, date, hits) VALUES (?, ?, ?, ?)').bind(teamId, anonId, date, hits).run();

// Today's board: players, average, top 5 by hits.
export async function dayBoard(db, teamId, date) {
  const [agg, top] = await db.batch([
    db.prepare('SELECT COUNT(*) AS players, AVG(hits) AS avg FROM scores WHERE team_id = ? AND date = ?').bind(teamId, date),
    db.prepare('SELECT anon_id, hits FROM scores WHERE team_id = ? AND date = ? ORDER BY hits DESC, anon_id LIMIT 5').bind(teamId, date),
  ]);
  return { ...agg.results[0], top: top.results };
}

// Board since `since` (inclusive): distinct players, plays, top 10 by total hits, ties by more plays.
export async function periodBoard(db, teamId, since) {
  const [agg, top] = await db.batch([
    db.prepare('SELECT COUNT(DISTINCT anon_id) AS players, COUNT(*) AS plays FROM scores WHERE team_id = ? AND date >= ?').bind(teamId, since),
    db.prepare(
      `SELECT anon_id, SUM(hits) AS hits, COUNT(*) AS plays FROM scores WHERE team_id = ? AND date >= ?
       GROUP BY anon_id ORDER BY hits DESC, plays DESC, anon_id LIMIT 10`,
    ).bind(teamId, since),
  ]);
  return { ...agg.results[0], top: top.results };
}
