// OAuth 1.0a request signing (HMAC-SHA1) with WebCrypto only. X still requires it for user-context writes such as
// POST /2/tweets; JSON bodies are not part of the signature, only query parameters and the oauth_* fields are.

// RFC 3986 percent-encoding: encodeURIComponent leaves !'()* alone, OAuth does not.
export const enc = (s) => encodeURIComponent(s).replace(/[!'()*]/g, (c) => `%${c.charCodeAt(0).toString(16).toUpperCase()}`);

async function hmacSha1(key, text) {
  const k = await crypto.subtle.importKey('raw', new TextEncoder().encode(key), { name: 'HMAC', hash: 'SHA-1' }, false, ['sign']);
  const sig = await crypto.subtle.sign('HMAC', k, new TextEncoder().encode(text));
  return btoa(String.fromCharCode(...new Uint8Array(sig)));
}

// The signature base string for `method` on `url` (query string included in `url` or passed as `params`) plus the
// oauth_* fields; exported for the test vector in test/oauth.test.js.
export function baseString(method, url, params) {
  const u = new URL(url);
  const all = { ...Object.fromEntries(u.searchParams), ...params };
  const normalized = Object.keys(all)
    .map((k) => [enc(k), enc(all[k])])
    .sort((a, b) => (a[0] === b[0] ? a[1].localeCompare(b[1]) : a[0].localeCompare(b[0])))
    .map(([k, v]) => `${k}=${v}`)
    .join('&');
  return `${method.toUpperCase()}&${enc(`${u.origin}${u.pathname}`)}&${enc(normalized)}`;
}

// The Authorization header value for one request. `extra` holds body parameters only for form-encoded bodies.
export async function oauthHeader({ method, url, key, secret, token, tokenSecret, extra = {}, nonce, timestamp }) {
  const oauth = {
    oauth_consumer_key: key,
    oauth_nonce: nonce ?? crypto.randomUUID().replace(/-/g, ''),
    oauth_signature_method: 'HMAC-SHA1',
    oauth_timestamp: timestamp ?? String(Math.floor(Date.now() / 1000)),
    oauth_token: token,
    oauth_version: '1.0',
  };
  const signature = await hmacSha1(`${enc(secret)}&${enc(tokenSecret)}`, baseString(method, url, { ...oauth, ...extra }));
  const fields = { ...oauth, oauth_signature: signature };
  return `OAuth ${Object.keys(fields).sort().map((k) => `${enc(k)}="${enc(fields[k])}"`).join(', ')}`;
}
