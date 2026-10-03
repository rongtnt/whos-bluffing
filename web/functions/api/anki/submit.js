import { json, safe } from '../../_util.js';
import { readAnkiJson, submit } from '../../_anki.js';

export const onRequestPost = safe(async ({ request, env }) => {
  const { body, error } = await readAnkiJson(request);
  if (error) return error;
  const r = await submit(env.DB, body, new Date());
  return json(r.body, r.status);
});
