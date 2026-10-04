import { json, safe, readJson } from '../../_util.js';
import { answer } from '../../_rounds.js';
import { ROUNDS } from '../../_rounds_data.js';

export const onRequestPost = safe(async ({ request, env }) => {
  const { body, error } = await readJson(request);
  if (error) return error;
  const r = await answer(env.DB, ROUNDS, body, new Date());
  return json(r.body, r.status);
});
