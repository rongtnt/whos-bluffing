import { json, safe, readJson } from '../../_util.js';
import { complete } from '../../_rounds.js';
import { ROUNDS } from '../../_rounds_data.js';

export const onRequestPost = safe(async ({ request, env }) => {
  const { body, error } = await readJson(request);
  if (error) return error;
  const r = await complete(env.DB, ROUNDS, body, new Date(), new URL(request.url).origin);
  return json(r.body, r.status);
});
