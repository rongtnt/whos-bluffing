// Slack request signing: v0=HMAC-SHA256(signing secret, "v0:{timestamp}:{raw body}"), 5-minute replay window.

export const MAX_SKEW_S = 300;
const enc = new TextEncoder();

export async function verifySlack(secret, timestamp, signature, rawBody, nowMs = Date.now()) {
  if (!secret || !/^\d+$/.test(timestamp ?? '')) return false;
  if (Math.abs(nowMs / 1000 - Number(timestamp)) > MAX_SKEW_S) return false;
  const hex = /^v0=([0-9a-f]{64})$/.exec(signature ?? '')?.[1];
  if (!hex) return false;
  const sig = new Uint8Array(hex.match(/../g).map((h) => parseInt(h, 16)));
  const key = await crypto.subtle.importKey('raw', enc.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['verify']);
  // subtle.verify compares in constant time.
  return crypto.subtle.verify('HMAC', key, sig, enc.encode(`v0:${timestamp}:${rawBody}`));
}
