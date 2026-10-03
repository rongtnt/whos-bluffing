// HowSure for Anki v0.2 (migrations/0004_anki.sql): validation and the D1 work behind /api/anki/* and the KPI's
// anki_contributors_30d. Functions return {status, body}, like _daily.js. Bounded: a submit reads and writes only the
// request's own rows (one primary-key lookup each) plus the install's row and two anki_agg rows; a delete touches one
// install's rows; stats and the KPI read anki_agg only (one row per day).
import { fail } from './_util.js';
import { addDays, todayUTC } from './_daily.js';
import { publicKpi } from './_kpi.js';

export const MAX_ROWS = 2000;
export const MAX_BODY = 1_500_000; // 2,000 rows of about 500 bytes; D1 accepts bound strings up to 2 MB
const WINDOW_DAYS = 30;
const INSTALL_RE = /^[A-Za-z0-9_-]{32,64}$/;
const VERSION_RE = /^[A-Za-z0-9._+-]{1,32}$/;
const HASH_RE = /^[0-9a-f]{64}$/;
const ISO_RE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{1,6})?(Z|[+-]\d{2}:\d{2})$/;

const ok = (body) => ({ status: 200, body });
const err = (status, error) => ({ status, body: { error } });
const isObject = (x) => x !== null && typeof x === 'object' && !Array.isArray(x);
const matches = (re) => (v) => typeof v === 'string' && re.test(v);
const intIn = (lo, hi) => (v) => Number.isInteger(v) && v >= lo && v <= hi;
const finite = (v) => Number.isFinite(v);
const isoTime = (v) => matches(ISO_RE)(v) && Number.isFinite(Date.parse(v));

// Every anki_rows column after install_id: [check, required]. null is allowed where not required. Unknown keys are
// rejected and text fields only take hashes, versions and ISO times, so no free text (card content) can be stored.
const FIELDS = {
  row_id: [intIn(1, Number.MAX_SAFE_INTEGER), true],
  ts: [isoTime, false],
  card_hash: [matches(HASH_RE), false],
  deck_hash: [matches(HASH_RE), false],
  notetype_hash: [matches(HASH_RE), false],
  jol: [intIn(1, 5), true],
  ease: [intIn(1, 4), true],
  q_rt_ms: [finite, false],
  a_rt_ms: [finite, false],
  ivl_days: [finite, false],
  reps: [finite, false],
  lapses: [finite, false],
  days_since_last_review: [finite, false],
  stability: [finite, false],
  difficulty: [finite, false],
  retrievability: [finite, false],
  anki_version: [matches(VERSION_RE), false],
  addon_version: [matches(VERSION_RE), false],
};
export const ROW_COLUMNS = Object.keys(FIELDS);

const INSTALL_ERROR = 'install_id must be 32-64 characters of A-Z, a-z, 0-9, _ or -';

// Returns an error string or null.
export function validateSubmit(body) {
  if (!isObject(body)) return 'body must be a JSON object';
  if (!matches(INSTALL_RE)(body.install_id)) return INSTALL_ERROR;
  if (!matches(VERSION_RE)(body.addon_version)) return 'bad addon_version';
  if (!matches(VERSION_RE)(body.consent_version)) return 'bad consent_version';
  if (!Array.isArray(body.rows) || body.rows.length < 1 || body.rows.length > MAX_ROWS) return `rows must be an array of 1-${MAX_ROWS} rows`;
  const seen = new Set();
  for (const [i, row] of body.rows.entries()) {
    if (!isObject(row)) return `row ${i}: not an object`;
    const unknown = Object.keys(row).find((k) => !Object.hasOwn(FIELDS, k));
    if (unknown !== undefined) return `row ${i}: unknown field ${unknown.slice(0, 30)}`;
    for (const [k, [check, required]] of Object.entries(FIELDS)) {
      if (row[k] == null ? required : !check(row[k])) return `row ${i}: bad ${k}`;
    }
    if (seen.has(row.row_id)) return `row ${i}: duplicate row_id`;
    seen.add(row.row_id);
  }
  return null;
}

// Like _util.readJson, with room for 2,000 rows. Returns {body} or {error: Response}.
export async function readAnkiJson(request) {
  if (Number(request.headers.get('content-length')) > MAX_BODY) return { error: fail(413, 'request too large') };
  const text = await request.text();
  if (text.length > MAX_BODY) return { error: fail(413, 'request too large') };
  try {
    return { body: JSON.parse(text) };
  } catch {
    return { error: fail(400, 'invalid JSON') };
  }
}

const INSTALL_SQL = 'SELECT rows, deleted_at FROM anki_installs WHERE install_id = ?1';
// Takes a live install, with its rows, off the day of its latest upload (a submit then puts it on today).
const UNCOUNT_SQL = `UPDATE anki_agg SET installs = installs - 1, rows = rows - (SELECT rows FROM anki_installs WHERE install_id = ?1)
  WHERE day = (SELECT substr(last_seen, 1, 10) FROM anki_installs WHERE install_id = ?1 AND deleted_at IS NULL)`;
// Creates or updates the install and adds the request's rows that are not stored yet. Deleted installs are left alone.
const UPSERT_INSTALL_SQL = `INSERT INTO anki_installs (install_id, first_seen, last_seen, rows, consent_version)
  VALUES (?1, ?2, ?2, (SELECT COUNT(*) FROM json_each(?3) j WHERE NOT EXISTS
    (SELECT 1 FROM anki_rows r WHERE r.install_id = ?1 AND r.row_id = json_extract(j.value, '$.row_id'))), ?4)
  ON CONFLICT (install_id) DO UPDATE SET last_seen = excluded.last_seen, rows = rows + excluded.rows,
    consent_version = excluded.consent_version
  WHERE deleted_at IS NULL`;
const COUNT_SQL = `INSERT INTO anki_agg (day, installs, rows)
  SELECT substr(last_seen, 1, 10), 1, rows FROM anki_installs WHERE install_id = ?1 AND deleted_at IS NULL
  ON CONFLICT (day) DO UPDATE SET installs = installs + 1, rows = rows + excluded.rows`;
// The rows go in as one JSON parameter (D1 allows 100 bound parameters per statement, not 2,000 x 18).
const INSERT_ROWS_SQL = `INSERT INTO anki_rows (install_id, ${ROW_COLUMNS.join(', ')})
  SELECT ?1, ${ROW_COLUMNS.map((c) => `json_extract(j.value, '$.${c}')`).join(', ')} FROM json_each(?2) j
  WHERE EXISTS (SELECT 1 FROM anki_installs WHERE install_id = ?1 AND deleted_at IS NULL)
  ON CONFLICT (install_id, row_id) DO NOTHING`;
// Keeps only the id and the deletion time, so later uploads from this install are refused.
const TOMBSTONE_SQL = `INSERT INTO anki_installs (install_id, rows, deleted_at) VALUES (?1, 0, ?2)
  ON CONFLICT (install_id) DO UPDATE SET first_seen = NULL, last_seen = NULL, rows = 0, consent_version = NULL,
    deleted_at = COALESCE(deleted_at, excluded.deleted_at)`;

// POST /api/anki/submit. One batch (one transaction): rows are idempotent on (install_id, row_id); accepted is the
// stored count after minus before, read inside the same batch. A deleted install gets 410 and nothing is written.
export async function submit(db, body, now) {
  const invalid = validateSubmit(body);
  if (invalid) return err(400, invalid);
  const id = body.install_id;
  const rows = JSON.stringify(body.rows.map((r) => Object.fromEntries(ROW_COLUMNS.map((c) => [c, r[c] ?? null]))));
  const [before, , , , , after] = await db.batch([
    db.prepare(INSTALL_SQL).bind(id),
    db.prepare(UNCOUNT_SQL).bind(id),
    db.prepare(UPSERT_INSTALL_SQL).bind(id, now.toISOString(), rows, body.consent_version),
    db.prepare(COUNT_SQL).bind(id),
    db.prepare(INSERT_ROWS_SQL).bind(id, rows),
    db.prepare(INSTALL_SQL).bind(id),
  ]);
  const stored = after.results[0];
  if (stored.deleted_at) return err(410, 'data deleted for this installation');
  const accepted = stored.rows - (before.results[0]?.rows ?? 0);
  return ok({ accepted, duplicates: body.rows.length - accepted, total_rows_for_install: stored.rows });
}

// POST /api/anki/delete. Removes the install's rows, takes it off the aggregates and marks it deleted. Idempotent.
export async function remove(db, body, now) {
  if (!isObject(body) || !matches(INSTALL_RE)(body.install_id)) return err(400, INSTALL_ERROR);
  const id = body.install_id;
  const [before] = await db.batch([
    db.prepare(INSTALL_SQL).bind(id),
    db.prepare(UNCOUNT_SQL).bind(id),
    db.prepare('DELETE FROM anki_rows WHERE install_id = ?1').bind(id),
    db.prepare(TOMBSTONE_SQL).bind(id, now.toISOString()),
  ]);
  const b = before.results[0];
  return ok({ deleted_rows: b && !b.deleted_at ? b.rows : 0 });
}

// installs_30d = live installs whose latest upload is in the 30 UTC days ending asOf; rows_total = all stored rows.
const TOTALS_SQL = `SELECT COALESCE(SUM(CASE WHEN day BETWEEN ?1 AND ?2 THEN installs END), 0) AS installs_30d,
  COALESCE(SUM(rows), 0) AS rows_total FROM anki_agg`;
export const ankiTotals = (db, asOf) => db.prepare(TOTALS_SQL).bind(addDays(asOf, 1 - WINDOW_DAYS), asOf).first();

// GET /api/anki/stats body.
export const ankiStats = async (db, now) => ok(await ankiTotals(db, todayUTC(now)));

// KPI: stores anki_contributors_30d on the as_of row that runKpi just wrote (same window as installs_30d) and returns it.
export async function storeAnkiKpi(db, asOf) {
  const { installs_30d: n } = await ankiTotals(db, asOf);
  await db.prepare('UPDATE kpi SET anki_contributors_30d = ?1 WHERE as_of = ?2').bind(n, asOf).run();
  return n;
}

// GET /api/kpi body: the usual KPI shape plus anki_contributors_30d, a separate number that is not part of MAU.
export async function latestKpiWithAnki(db) {
  const row = await db.prepare('SELECT * FROM kpi ORDER BY as_of DESC LIMIT 1').first();
  return { ...publicKpi(row), anki_contributors_30d: row?.anki_contributors_30d ?? 0 };
}
