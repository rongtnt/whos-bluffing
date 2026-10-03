import { json, fail, safe, readJson, randomString, CODE_ALPHABET, SECRET_ALPHABET } from '../../_util.js';

const MAX_LABEL = 80;
const ATTEMPTS = 5;

export const onRequestPost = safe(async ({ request, env }) => {
  const { body, error } = await readJson(request, { optional: true });
  if (error) return error;
  const label = body?.label;
  if (label != null && (typeof label !== 'string' || label.length > MAX_LABEL)) {
    return fail(400, `label must be text of at most ${MAX_LABEL} characters`);
  }
  const origin = new URL(request.url).origin;
  for (let i = 0; i < ATTEMPTS; i += 1) {
    const code = randomString(6, CODE_ALPHABET);
    const secret = randomString(24, SECRET_ALPHABET);
    const res = await env.DB.prepare('INSERT OR IGNORE INTO classes (code, secret, label, created_at) VALUES (?, ?, ?, ?)')
      .bind(code, secret, label?.trim() || null, new Date().toISOString()).run();
    if (res.meta.changes === 1) {
      return json({ code, secret, join_url: `${origin}/?c=${code}`, dashboard_url: `${origin}/class/d/${secret}` });
    }
  }
  return fail(503, 'could not create a class code, try again');
});
