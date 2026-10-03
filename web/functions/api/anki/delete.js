import { json, safe, readJson } from '../../_util.js';
import { remove } from '../../_anki.js';

export const onRequestPost = safe(async ({ request, env }) => {
  const { body, error } = await readJson(request);
  if (error) return error;
  const r = await remove(env.DB, body, new Date());
  return json(r.body, r.status);
});
