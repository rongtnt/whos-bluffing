import test from 'node:test';
import assert from 'node:assert/strict';
import { baseString, oauthHeader } from '../src/oauth.js';

// The worked example from X's "Creating a signature" guide: known keys, nonce and timestamp give a known signature.
const v = {
  key: 'xvz1evFS4wEEPTGEFPHBog',
  secret: 'kAcSOqF21Fu85e7zjz7ZN2U4ZRhfV3WpwPAoE3Z7kBw',
  token: '370773112-GmHxMAgYyLbNEtIKZeRNFsMKPR9EyMZeS9weJAEb',
  tokenSecret: 'LswwdoUaIvS8ltyTt5jkRh4J50vUPVVHtR2YPi5kE',
  nonce: 'kYjzVBB8Y0ZFabxSWbWovY3uYSQ2pTgmZeNu2VS4cg',
  timestamp: '1318622958',
  method: 'POST',
  url: 'https://api.twitter.com/1.1/statuses/update.json?include_entities=true',
  extra: { status: 'Hello Ladies + Gentlemen, a signed OAuth request!' },
};

test('base string matches the documented example', () => {
  const s = baseString(v.method, v.url, {
    oauth_consumer_key: v.key, oauth_nonce: v.nonce, oauth_signature_method: 'HMAC-SHA1', oauth_timestamp: v.timestamp,
    oauth_token: v.token, oauth_version: '1.0', ...v.extra,
  });
  assert.equal(s, 'POST&https%3A%2F%2Fapi.twitter.com%2F1.1%2Fstatuses%2Fupdate.json&include_entities%3Dtrue%26oauth_consumer_key%3Dxvz1evFS4wEEPTGEFPHBog%26oauth_nonce%3DkYjzVBB8Y0ZFabxSWbWovY3uYSQ2pTgmZeNu2VS4cg%26oauth_signature_method%3DHMAC-SHA1%26oauth_timestamp%3D1318622958%26oauth_token%3D370773112-GmHxMAgYyLbNEtIKZeRNFsMKPR9EyMZeS9weJAEb%26oauth_version%3D1.0%26status%3DHello%2520Ladies%2520%252B%2520Gentlemen%252C%2520a%2520signed%2520OAuth%2520request%2521');
});

test('signature matches the documented example', async () => {
  const header = await oauthHeader(v);
  assert.match(header, /oauth_signature="hCtSmYh%2BiHYCEqBWrE7C7hYmtUk%3D"/);
  assert.ok(header.startsWith('OAuth oauth_consumer_key="xvz1evFS4wEEPTGEFPHBog", oauth_nonce='));
});
