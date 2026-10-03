import { json, safe, CODE_RE } from '../../_util.js';

export const onRequestGet = safe(async ({ params, env }) => {
  const code = String(params.code).toUpperCase();
  if (!CODE_RE.test(code)) return json({ exists: false, label: null });
  const row = await env.DB.prepare('SELECT label FROM classes WHERE code = ?').bind(code).first();
  return json({ exists: Boolean(row), label: row?.label ?? null });
});
