// Short-lived party state. All identities and chat scopes are salted hashes.
const changed = (r) => r.meta.changes === 1;
export const LIFETIME = 60 * 60 * 1000;
const LEASE_MS = 30_000;

export async function get(db, id) {
  const p = await db.prepare('SELECT * FROM parties WHERE id = ?').bind(id).first();
  return p && { ...p, items: p.items && JSON.parse(p.items) };
}

export const create = (db, id, scope, message, now, { pack = 'memes', difficulty = 'normal' } = {}) => db.prepare(
  'INSERT OR IGNORE INTO parties (id, scope, message_id, expires_at, pack, difficulty) VALUES (?, ?, ?, ?, ?, ?)',
).bind(id, scope, message, now + LIFETIME, pack, difficulty).run();

export const bindMessage = (db, id, message) => db.prepare(
  'UPDATE parties SET message_id = ? WHERE id = ? AND message_id IS NULL',
).bind(message, id).run();

export const claimRound = async (db, id, lease, now) => changed(await db.prepare(
  'UPDATE parties SET lease = ?, lease_until = ? WHERE id = ? AND round_id IS NULL AND lease_until <= ? AND expires_at > ?',
).bind(lease, now + LEASE_MS, id, now, now).run());

export const saveRound = (db, id, lease, round) => db.prepare(
  'UPDATE parties SET round_id = ?, items = ?, lease = NULL, lease_until = 0 WHERE id = ? AND lease = ?',
).bind(round.round_id, JSON.stringify(round.items), id, lease).run();

export const releaseRound = (db, id, lease) => db.prepare(
  'UPDATE parties SET lease = NULL, lease_until = 0 WHERE id = ? AND lease = ?',
).bind(id, lease).run();

export const setNext = (db, id, next) => db.prepare(
  'UPDATE parties SET next_id = ? WHERE id = ? AND next_id IS NULL',
).bind(next, id).run();

export async function player(db, id, anon) {
  const p = await db.prepare('SELECT * FROM party_players WHERE party_id = ? AND anon_id = ?').bind(id, anon).first();
  return p && { ...p, last_result: p.last_result && JSON.parse(p.last_result), done: p.done && JSON.parse(p.done) };
}

export async function join(db, id, anon, name, now) {
  // One SQLite statement gives concurrent joiners distinct seat numbers for stable score ties.
  await db.prepare(`INSERT OR IGNORE INTO party_players (party_id, anon_id, name, seat, updated_at)
    SELECT ?, ?, ?, COALESCE(MAX(seat), 0) + 1, ? FROM party_players WHERE party_id = ?`)
    .bind(id, anon, name, now, id).run();
  return player(db, id, anon);
}

export const bindPlayerMessage = (db, id, anon, message) => db.prepare(
  'UPDATE party_players SET message_id = ? WHERE party_id = ? AND anon_id = ?',
).bind(message, id, anon).run();

export async function board(db, id) {
  const count = await db.prepare('SELECT COUNT(*) AS joined, COUNT(done) AS finished FROM party_players WHERE party_id = ?').bind(id).first();
  const { results } = await db.prepare(`SELECT seat, name, total AS score FROM party_players
    WHERE party_id = ? AND done IS NOT NULL ORDER BY total DESC, seat LIMIT 10`).bind(id).all();
  return { ...count, top: results };
}

export const claimPlayer = async (db, id, anon, step, lease, now) => changed(await db.prepare(
  `UPDATE party_players SET lease = ?, lease_until = ? WHERE party_id = ? AND anon_id = ?
   AND step = ? AND done IS NULL AND lease_until <= ?`,
).bind(lease, now + LEASE_MS, id, anon, step, now).run());

export const saveAnswer = (db, id, anon, lease, total, result) => db.prepare(
  `UPDATE party_players SET step = step + 1, total = ?, last_result = ?, lease = NULL, lease_until = 0
   WHERE party_id = ? AND anon_id = ? AND lease = ?`,
).bind(total, JSON.stringify(result), id, anon, lease).run();

export const nextQuestion = (db, id, anon, step, now) => db.prepare(
  'UPDATE party_players SET last_result = NULL, updated_at = ? WHERE party_id = ? AND anon_id = ? AND step = ? AND lease IS NULL',
).bind(now, id, anon, step).run();

export const finish = (db, id, anon, lease, done) => db.prepare(
  'UPDATE party_players SET done = ?, total = ?, last_result = NULL, lease = NULL, lease_until = 0 WHERE party_id = ? AND anon_id = ? AND lease = ?',
).bind(JSON.stringify(done), Math.round(done.score), id, anon, lease).run();

export const releasePlayer = (db, id, anon, lease) => db.prepare(
  'UPDATE party_players SET lease = NULL, lease_until = 0 WHERE party_id = ? AND anon_id = ? AND lease = ?',
).bind(id, anon, lease).run();

export async function purge(db, now) {
  // Explicit child deletion also works in local test databases without foreign_keys enabled.
  await db.prepare('DELETE FROM party_players WHERE party_id IN (SELECT id FROM parties WHERE expires_at <= ?)').bind(now).run();
  await db.prepare('DELETE FROM parties WHERE expires_at <= ?').bind(now).run();
}
