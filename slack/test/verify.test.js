import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHmac } from 'node:crypto';
import { verifySlack, MAX_SKEW_S } from '../src/verify.js';
import { SECRET, makeEnv, mockFetch, send, signedRequest, slashBody } from './helpers.js';

const sign = (ts, body, secret = SECRET) => `v0=${createHmac('sha256', secret).update(`v0:${ts}:${body}`).digest('hex')}`;
const NOW = 1_790_000_000_000;
const TS = String(NOW / 1000);
const BODY = 'command=%2Fhowsure&text=';

test('signature: valid passes; tampered body, wrong secret, malformed header, missing timestamp fail', async () => {
  assert.equal(await verifySlack(SECRET, TS, sign(TS, BODY), BODY, NOW), true);
  assert.equal(await verifySlack(SECRET, TS, sign(TS, BODY), `${BODY}x`, NOW), false);
  assert.equal(await verifySlack(SECRET, TS, sign(TS, BODY, 'other-secret'), BODY, NOW), false);
  assert.equal(await verifySlack(SECRET, TS, 'v0=not-hex', BODY, NOW), false);
  assert.equal(await verifySlack(SECRET, null, sign(TS, BODY), BODY, NOW), false);
  assert.equal(await verifySlack(undefined, TS, sign(TS, BODY), BODY, NOW), false);
});

test('signature: stale timestamp (outside 5 minutes) fails even when correctly signed', async () => {
  const stale = String(NOW / 1000 - MAX_SKEW_S - 1);
  assert.equal(await verifySlack(SECRET, stale, sign(stale, BODY), BODY, NOW), false);
  const future = String(NOW / 1000 + MAX_SKEW_S + 1);
  assert.equal(await verifySlack(SECRET, future, sign(future, BODY), BODY, NOW), false);
  const inside = String(NOW / 1000 - MAX_SKEW_S + 1);
  assert.equal(await verifySlack(SECRET, inside, sign(inside, BODY), BODY, NOW), true);
});

test('router answers 401 to forged or stale requests and calls nothing', async () => {
  const calls = mockFetch();
  const env = makeEnv();
  const stale = await send(env, signedRequest(slashBody(), { ts: Math.floor(Date.now() / 1000) - 600 }));
  const forged = await send(env, signedRequest(slashBody(), { secret: 'wrong-secret' }));
  assert.equal(stale.status, 401);
  assert.equal(forged.status, 401);
  assert.equal(calls.length, 0);
});
