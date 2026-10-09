// State expires after one hour; hourly cleanup removes opted-in names and progress.
export const LIFETIME = 3_600_000;
const LEASE_MS = 30_000;
const changed = (r) => r.meta.changes === 1;
const decoded = (p, fields) => p && Object.fromEntries(Object.entries(p).map(([k, v]) => [k, fields.includes(k) && v ? JSON.parse(v) : v]));
export const get = async (db, id) => decoded(await db.prepare('SELECT * FROM play_sessions WHERE id = ?').bind(id).first(), ['items']);
export const player = async (db, id, anon) => decoded(await db.prepare('SELECT * FROM play_players WHERE session_id = ? AND anon_id = ?').bind(id, anon).first(), ['feedback', 'done']);
export const create = (db, { id, kind, scope, owner, pack = 'memes', difficulty = 'normal', lobby_ts = null, parent_round = null }, now) => db.prepare(
  'INSERT OR IGNORE INTO play_sessions (id, kind, scope, owner, pack, difficulty, lobby_ts, parent_round, expires_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
).bind(id, kind, scope, owner, pack, difficulty, lobby_ts, parent_round, now + LIFETIME).run();
export const claimSession = async (db, id, lease, now) => changed(await db.prepare(
  'UPDATE play_sessions SET lease = ?, lease_until = ? WHERE id = ? AND lease_until <= ? AND expires_at > ?',
).bind(lease, now + LEASE_MS, id, now, now).run());
export const saveRound = (db, id, lease, round, pack, difficulty) => db.prepare(
  'UPDATE play_sessions SET round_id = ?, items = ?, pack = ?, difficulty = ? WHERE id = ? AND lease = ?',
).bind(round.round_id, JSON.stringify(round.items), pack, difficulty, id, lease).run();
export const bindLobby = (db, id, lease, ts) => db.prepare('UPDATE play_sessions SET lobby_ts = ? WHERE id = ? AND lease = ?').bind(ts, id, lease).run();
export const releaseSession = (db, id, lease) => db.prepare('UPDATE play_sessions SET lease = NULL, lease_until = 0 WHERE id = ? AND lease = ?').bind(id, lease).run();
export const setNext = (db, id, next) => db.prepare('UPDATE play_sessions SET next_id = ? WHERE id = ? AND next_id IS NULL').bind(next, id).run();
export async function join(db, id, anon, name, now) {
  await db.prepare(`INSERT OR IGNORE INTO play_players (session_id, anon_id, name, seat, updated_at)
    SELECT ?, ?, ?, COALESCE(MAX(seat), 0) + 1, ? FROM play_players WHERE session_id = ?`).bind(id, anon, name, now, id).run();
  return player(db, id, anon);
}
export async function board(db, id) {
  const count = await db.prepare('SELECT COUNT(*) AS joined, COUNT(done) AS finished FROM play_players WHERE session_id = ?').bind(id).first();
  const { results } = await db.prepare('SELECT name, total AS score FROM play_players WHERE session_id = ? AND done IS NOT NULL ORDER BY total DESC, seat LIMIT 10').bind(id).all();
  return { ...count, top: results };
}
export const claimPlayer = async (db, id, anon, step, lease, now) => changed(await db.prepare(
  'UPDATE play_players SET lease = ?, lease_until = ? WHERE session_id = ? AND anon_id = ? AND step = ? AND done IS NULL AND lease_until <= ?',
).bind(lease, now + LEASE_MS, id, anon, step, now).run());
export const saveAnswer = (db, id, anon, lease, total, feedback) => db.prepare(
  'UPDATE play_players SET step = step + 1, total = ?, feedback = ?, lease = NULL, lease_until = 0 WHERE session_id = ? AND anon_id = ? AND lease = ?',
).bind(total, JSON.stringify(feedback), id, anon, lease).run();
export const next = (db, id, anon, step, now) => db.prepare(
  'UPDATE play_players SET feedback = NULL, updated_at = ? WHERE session_id = ? AND anon_id = ? AND step = ? AND lease IS NULL',
).bind(now, id, anon, step).run();
export const finish = (db, id, anon, lease, done) => db.prepare(
  'UPDATE play_players SET done = ?, total = ?, feedback = NULL, lease = NULL, lease_until = 0 WHERE session_id = ? AND anon_id = ? AND lease = ?',
).bind(JSON.stringify(done), done.score, id, anon, lease).run();
export const releasePlayer = (db, id, anon, lease) => db.prepare('UPDATE play_players SET lease = NULL, lease_until = 0 WHERE session_id = ? AND anon_id = ? AND lease = ?').bind(id, anon, lease).run();
// Sharing is explicit and at most once for a completed player. Release after a failed send.
export const claimShare = async (db, id, anon) => changed(await db.prepare('UPDATE play_players SET shared = 1 WHERE session_id = ? AND anon_id = ? AND done IS NOT NULL AND shared = 0').bind(id, anon).run());
export const releaseShare = (db, id, anon) => db.prepare('UPDATE play_players SET shared = 0 WHERE session_id = ? AND anon_id = ?').bind(id, anon).run();
export async function purge(db, now) {
  await db.prepare('DELETE FROM play_players WHERE session_id IN (SELECT id FROM play_sessions WHERE expires_at <= ?)').bind(now).run();
  await db.prepare('DELETE FROM play_sessions WHERE expires_at <= ?').bind(now).run();
}
