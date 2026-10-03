// HowSure for Anki v0.2 endpoint logic (functions/_anki.js) on a real SQLite database (test/d1.js).
// HTTP wiring is covered by test/smoke.sh.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { openD1 } from './d1.js';
import {
  MAX_ROWS, MAX_BODY, ROW_COLUMNS, validateSubmit, readAnkiJson, submit, remove, ankiStats, storeAnkiKpi, latestKpiWithAnki,
} from '../functions/_anki.js';
import { runKpi, latestKpi } from '../functions/_kpi.js';

const HEX = (c) => c.repeat(64);
const A = 'a'.repeat(64); // install ids as the add-on sends them: 64-char sha256 hex
const B = 'b'.repeat(64);
const row = (rowId, over = {}) => ({
  row_id: rowId, card_hash: HEX('1'), deck_hash: HEX('2'), jol: 4, ease: 3, q_rt_ms: 1500, a_rt_ms: 800, ivl_days: 12,
  days_since_last_review: 11.5, stability: 14.25, difficulty: 5.5, retrievability: 0.9, anki_version: '26.09.3',
  addon_version: '0.2.0', ...over,
});
const body = (installId, rows, over = {}) => ({ install_id: installId, addon_version: '0.2.0', consent_version: '1', rows, ...over });
const at = (iso) => new Date(iso);
const agg = (db) => db.sqlite.prepare('SELECT day, installs, rows FROM anki_agg WHERE installs != 0 OR rows != 0 ORDER BY day').all()
  .map((r) => ({ ...r }));
const count = (db, sql, ...p) => db.sqlite.prepare(sql).get(...p).n;

test('anki submit validation: whitelisted columns only, ranges, finite numbers, ISO time, 1-2,000 unique rows', () => {
  assert.equal(validateSubmit(body(A, [row(1), row(2, { ts: '2026-10-03T12:00:00+00:00', reps: 3, lapses: 0, notetype_hash: HEX('3') })])), null);
  assert.equal(validateSubmit(body(A, [row(1, { q_rt_ms: null, stability: null, card_hash: null })])), null);
  const bad = (b) => validateSubmit(b);
  assert.match(bad(null), /JSON object/);
  assert.match(bad(body('short', [row(1)])), /install_id/);
  assert.match(bad(body('x'.repeat(65), [row(1)])), /install_id/);
  assert.match(bad(body(A, [row(1)], { consent_version: undefined })), /consent_version/);
  assert.match(bad(body(A, [])), /1-2000/);
  assert.match(bad(body(A, Array.from({ length: MAX_ROWS + 1 }, (_, i) => row(i + 1)))), /1-2000/);
  assert.match(bad(body(A, [row(1, { front: 'card text' })])), /unknown field front/);
  assert.match(bad(body(A, [row(1, { toString: 1 })])), /unknown field toString/);
  assert.match(bad(body(A, [row(1, { card_hash: 'What is the capital of France?' })])), /bad card_hash/);
  assert.match(bad(body(A, [row(1, { jol: 0 })])), /bad jol/);
  assert.match(bad(body(A, [row(1, { jol: 6 })])), /bad jol/);
  assert.match(bad(body(A, [row(1, { ease: 5 })])), /bad ease/);
  assert.match(bad(body(A, [row(1, { ease: null })])), /bad ease/);
  assert.match(bad(body(A, [row(1, { q_rt_ms: '1500' })])), /bad q_rt_ms/);
  assert.match(bad(body(A, [row(1, { ts: '2026-10-03 12:00' })])), /bad ts/);
  assert.match(bad(body(A, [row(1, { anki_version: 'x'.repeat(33) })])), /bad anki_version/);
  assert.match(bad(body(A, [row(0)])), /bad row_id/);
  assert.match(bad(body(A, [row(1), row(1)])), /duplicate row_id/);
  assert.deepEqual(ROW_COLUMNS.slice(0, 3), ['row_id', 'ts', 'card_hash']);
});

test('anki body reader: room for 2,000 rows, 413 above MAX_BODY, 400 on invalid JSON', async () => {
  const big = JSON.stringify(body(A, Array.from({ length: MAX_ROWS }, (_, i) => row(i + 1, {
    ts: '2026-10-03T12:00:00+00:00', notetype_hash: HEX('3'), reps: 120, lapses: 12,
  }))));
  assert.ok(big.length < MAX_BODY, `2,000 full rows are ${big.length} characters`);
  const read = (text) => readAnkiJson(new Request('https://h/api/anki/submit', { method: 'POST', body: text }));
  assert.equal((await read(big)).body.rows.length, MAX_ROWS);
  assert.equal((await read('x'.repeat(MAX_BODY + 1))).error.status, 413);
  const declared = new Request('https://h/api/anki/submit', { method: 'POST', body: '{}', headers: { 'content-length': String(MAX_BODY + 1) } });
  assert.equal((await readAnkiJson(declared)).error.status, 413); // refused from the header, before reading the body
  assert.equal((await read('{nope')).error.status, 400);
});

test('anki submit: idempotent upsert, accepted/duplicates/total, whitelisted columns stored, aggregates by last upload day', async () => {
  const db = openD1();
  const first = await submit(db, body(A, [row(1), row(2), row(3)]), at('2026-10-01T10:00:00Z'));
  assert.deepEqual(first, { status: 200, body: { accepted: 3, duplicates: 0, total_rows_for_install: 3 } });
  const again = await submit(db, body(A, [row(1), row(2), row(3)]), at('2026-10-01T11:00:00Z'));
  assert.deepEqual(again.body, { accepted: 0, duplicates: 3, total_rows_for_install: 3 });
  const stored = { ...db.sqlite.prepare('SELECT * FROM anki_rows WHERE install_id = ? AND row_id = 2').get(A) };
  assert.deepEqual(stored, {
    install_id: A, row_id: 2, ts: null, card_hash: HEX('1'), deck_hash: HEX('2'), notetype_hash: null, jol: 4, ease: 3,
    q_rt_ms: 1500, a_rt_ms: 800, ivl_days: 12, reps: null, lapses: null, days_since_last_review: 11.5, stability: 14.25,
    difficulty: 5.5, retrievability: 0.9, anki_version: '26.09.3', addon_version: '0.2.0',
  });
  assert.deepEqual(agg(db), [{ day: '2026-10-01', installs: 1, rows: 3 }]);

  // Two days later: two new rows, one repeat. The install and all its rows move to the new day.
  const later = await submit(db, body(A, [row(3), row(4), row(5)]), at('2026-10-03T09:00:00Z'));
  assert.deepEqual(later.body, { accepted: 2, duplicates: 1, total_rows_for_install: 5 });
  await submit(db, body(B, [row(1)], { consent_version: '2' }), at('2026-10-03T12:00:00Z'));
  assert.deepEqual(agg(db), [{ day: '2026-10-03', installs: 2, rows: 6 }]);
  const install = { ...db.sqlite.prepare('SELECT * FROM anki_installs WHERE install_id = ?').get(A) };
  assert.deepEqual(install, {
    install_id: A, first_seen: '2026-10-01T10:00:00.000Z', last_seen: '2026-10-03T09:00:00.000Z', rows: 5,
    consent_version: '1', deleted_at: null,
  });
  assert.equal(count(db, 'SELECT COUNT(*) AS n FROM anki_rows'), 6);
  assert.deepEqual((await ankiStats(db, at('2026-10-03T13:00:00Z'))).body, { installs_30d: 2, rows_total: 6 });
  // 30-day window: on Nov 1 both installs (last upload Oct 3) are still counted; on Nov 2 they are not; rows stay.
  assert.deepEqual((await ankiStats(db, at('2026-11-01T00:00:00Z'))).body, { installs_30d: 2, rows_total: 6 });
  assert.deepEqual((await ankiStats(db, at('2026-11-02T00:00:00Z'))).body, { installs_30d: 0, rows_total: 6 });
});

test('anki delete: rows gone, aggregates decremented, tombstone keeps only id and time, idempotent; later submits 410 and write nothing', async () => {
  const db = openD1();
  await submit(db, body(A, [row(1), row(2), row(3)]), at('2026-10-01T10:00:00Z'));
  await submit(db, body(B, [row(1), row(2)]), at('2026-10-02T10:00:00Z'));
  assert.deepEqual(await remove(db, { install_id: A }, at('2026-10-03T08:00:00Z')), { status: 200, body: { deleted_rows: 3 } });
  assert.equal(count(db, 'SELECT COUNT(*) AS n FROM anki_rows WHERE install_id = ?', A), 0);
  assert.deepEqual(agg(db), [{ day: '2026-10-02', installs: 1, rows: 2 }]);
  assert.deepEqual({ ...db.sqlite.prepare('SELECT * FROM anki_installs WHERE install_id = ?').get(A) }, {
    install_id: A, first_seen: null, last_seen: null, rows: 0, consent_version: null, deleted_at: '2026-10-03T08:00:00.000Z',
  });
  assert.deepEqual((await remove(db, { install_id: A }, at('2026-10-04T08:00:00Z'))).body, { deleted_rows: 0 });
  assert.deepEqual(agg(db), [{ day: '2026-10-02', installs: 1, rows: 2 }]); // no double decrement
  const gone = await submit(db, body(A, [row(4)]), at('2026-10-05T08:00:00Z'));
  assert.equal(gone.status, 410);
  assert.equal(count(db, 'SELECT COUNT(*) AS n FROM anki_rows WHERE install_id = ?', A), 0);
  assert.deepEqual(agg(db), [{ day: '2026-10-02', installs: 1, rows: 2 }]);
  assert.equal(db.sqlite.prepare('SELECT deleted_at FROM anki_installs WHERE install_id = ?').get(A).deleted_at, '2026-10-03T08:00:00.000Z');
  // Deleting an id that never uploaded marks it deleted, so a stray upload from it is refused too.
  const C = 'c'.repeat(32);
  assert.deepEqual((await remove(db, { install_id: C }, at('2026-10-05T09:00:00Z'))).body, { deleted_rows: 0 });
  assert.equal((await submit(db, body(C, [row(1)]), at('2026-10-05T10:00:00Z'))).status, 410);
  assert.deepEqual((await ankiStats(db, at('2026-10-05T12:00:00Z'))).body, { installs_30d: 1, rows_total: 2 });
  assert.equal((await remove(db, { install_id: 'nope' }, at('2026-10-05T12:00:00Z'))).status, 400);
});

test('anki KPI: anki_contributors_30d stored on the KPI row and served next to MAU; existing KPI shape unchanged', async () => {
  const db = openD1();
  await submit(db, body(A, [row(1)]), at('2026-10-20T10:00:00Z'));
  await submit(db, body(B, [row(1)]), at('2026-09-01T10:00:00Z')); // outside the window ending 2026-10-31
  assert.equal((await latestKpiWithAnki(db)).anki_contributors_30d, 0);
  await runKpi(db, '2026-10-31', at('2026-11-01T00:10:00Z'));
  assert.equal(await storeAnkiKpi(db, '2026-10-31'), 1);
  const served = await latestKpiWithAnki(db);
  const { anki_contributors_30d: n, ...rest } = served;
  assert.equal(n, 1);
  assert.deepEqual(rest, await latestKpi(db)); // the PREREG numbers are untouched; MAU does not include Anki
  assert.equal(served.mau, 0);
});

test('anki request queries use primary keys, never a scan of anki_rows', () => {
  const db = openD1();
  const plan = (sql) => db.sqlite.prepare(`EXPLAIN QUERY PLAN ${sql}`).all().map((r) => r.detail).join(' | ');
  const lookup = plan(`SELECT COUNT(*) FROM json_each('[]') j WHERE NOT EXISTS
    (SELECT 1 FROM anki_rows r WHERE r.install_id = 'x' AND r.row_id = json_extract(j.value, '$.row_id'))`);
  assert.match(lookup, /SEARCH r USING PRIMARY KEY \(install_id=\? AND row_id=\?\)/);
  assert.match(plan("DELETE FROM anki_rows WHERE install_id = 'x'"), /SEARCH anki_rows USING PRIMARY KEY \(install_id=\?\)/);
  assert.match(plan("SELECT rows FROM anki_installs WHERE install_id = 'x'"), /USING INDEX sqlite_autoindex_anki_installs_1/);
  assert.match(plan("UPDATE anki_agg SET installs = 0 WHERE day = '2026-10-01'"), /USING INDEX sqlite_autoindex_anki_agg_1/);
});
