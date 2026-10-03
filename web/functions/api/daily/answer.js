import { json, safe, readJson } from '../../_util.js';
import { answer } from '../../_daily.js';
import { DAILY } from '../../_daily_data.js';

export const onRequestPost = safe(async ({ request, env }) => {
  const { body, error } = await readJson(request);
  if (error) return error;
  const r = await answer(env.DB, DAILY, body, new Date());
  return json(r.body, r.status);
});
