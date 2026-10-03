// The KPI cron Worker (web/kpi-worker): calls the run endpoint once for yesterday (UTC) with the key.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import worker, { runKpi, yesterdayUTC } from '../kpi-worker/src/index.js';

test('KPI worker: POSTs yesterday (UTC) to RUN_URL with x-kpi-key; a failed run throws', async (t) => {
  const calls = [];
  t.mock.method(globalThis, 'fetch', async (url, init) => {
    calls.push({ url, init });
    return new Response(JSON.stringify({ as_of: '2026-10-20', mau: 3 }), { status: calls.length === 1 ? 200 : 401 });
  });
  const env = { RUN_URL: 'https://howsure.example/api/kpi/run', KPI_KEY: 'k3y' };
  const at = Date.parse('2026-10-21T00:10:00Z');
  assert.equal(yesterdayUTC(at), '2026-10-20');
  assert.deepEqual(await runKpi(env, at), { as_of: '2026-10-20', mau: 3 });
  assert.equal(calls[0].url, 'https://howsure.example/api/kpi/run?as_of=2026-10-20');
  assert.deepEqual(calls[0].init, { method: 'POST', headers: { 'x-kpi-key': 'k3y' } });
  await assert.rejects(runKpi(env, at), /status 401/);
  const waited = [];
  worker.scheduled({ scheduledTime: at }, env, { waitUntil: (p) => waited.push(p.catch(() => 'failed')) });
  assert.equal(waited.length, 1);
  await Promise.all(waited);
});
