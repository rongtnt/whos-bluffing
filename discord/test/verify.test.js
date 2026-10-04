import { test } from 'node:test';
import assert from 'node:assert/strict';
import { generateKeyPairSync } from 'node:crypto';
import { MAX_SKEW_S, verifyDiscord } from '../src/verify.js';
import { PUBLIC_KEY, makeEnv, mockFetch, send, signBody, signWith, signedRequest } from './helpers.js';

const NOW = 1_790_000_000_000;
const TS = String(NOW / 1000);
const BODY = '{"type":1}';

test('signature: valid passes; tampered body, another key, malformed signature or key, missing timestamp fail', async () => {
  const sig = signBody(TS, BODY);
  assert.equal(await verifyDiscord(PUBLIC_KEY, TS, sig, BODY, NOW), true);
  assert.equal(await verifyDiscord(PUBLIC_KEY, TS, sig, `${BODY} `, NOW), false);
  assert.equal(await verifyDiscord(PUBLIC_KEY, TS, signWith(generateKeyPairSync('ed25519').privateKey, TS, BODY), BODY, NOW), false);
  assert.equal(await verifyDiscord(PUBLIC_KEY, TS, 'not-hex', BODY, NOW), false);
  assert.equal(await verifyDiscord(PUBLIC_KEY, null, sig, BODY, NOW), false);
  assert.equal(await verifyDiscord(undefined, TS, sig, BODY, NOW), false);
  assert.equal(await verifyDiscord('ff'.repeat(32), TS, sig, BODY, NOW), false); // not a usable key
});

test('signature: stale or future timestamp (outside 5 minutes) fails even when correctly signed', async () => {
  const at = (s) => String(NOW / 1000 + s);
  for (const s of [-MAX_SKEW_S - 1, MAX_SKEW_S + 1]) {
    assert.equal(await verifyDiscord(PUBLIC_KEY, at(s), signBody(at(s), BODY), BODY, NOW), false);
  }
  assert.equal(await verifyDiscord(PUBLIC_KEY, at(1 - MAX_SKEW_S), signBody(at(1 - MAX_SKEW_S), BODY), BODY, NOW), true);
});

test('PING with a valid signature gets PONG; forged or stale signatures get 401 and call nothing', async () => {
  const calls = mockFetch();
  const env = makeEnv();
  const pong = await send(env, signedRequest({ type: 1 }));
  assert.equal(pong.status, 200);
  assert.deepEqual(await pong.json(), { type: 1 });

  const forged = await send(env, signedRequest({ type: 1 }, { sig: 'ab'.repeat(64) }));
  const stale = await send(env, signedRequest({ type: 1 }, { ts: Math.floor(Date.now() / 1000) - 600 }));
  assert.equal(forged.status, 401);
  assert.equal(stale.status, 401);
  assert.equal(calls.length, 0);
});
