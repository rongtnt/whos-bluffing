// Discord request signing: Ed25519 over timestamp + raw body, checked with the app's public key (hex).
// Workers' crypto.subtle verifies Ed25519 natively (checked in workerd, see NOTES.md), so nothing is vendored.
// Discord documents no replay window; this keeps Slack's 5 minutes.

export const MAX_SKEW_S = 300;
const enc = new TextEncoder();
const fromHex = (hex) => Uint8Array.from(hex.match(/../g), (h) => parseInt(h, 16));

export async function verifyDiscord(publicKey, timestamp, signature, rawBody, nowMs = Date.now()) {
  if (!/^[0-9a-f]{64}$/i.test(publicKey ?? '') || !/^[0-9a-f]{128}$/i.test(signature ?? '')) return false;
  if (!/^\d+$/.test(timestamp ?? '') || Math.abs(nowMs / 1000 - Number(timestamp)) > MAX_SKEW_S) return false;
  try {
    const key = await crypto.subtle.importKey('raw', fromHex(publicKey), { name: 'Ed25519' }, false, ['verify']);
    return await crypto.subtle.verify('Ed25519', key, fromHex(signature), enc.encode(timestamp + rawBody));
  } catch {
    return false; // a key that is not a valid curve point
  }
}
