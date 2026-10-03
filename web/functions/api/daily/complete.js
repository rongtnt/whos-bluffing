import { json, safe, readJson } from '../../_util.js';
import { complete } from '../../_daily.js';
import { DAILY } from '../../_daily_data.js';

export const onRequestPost = safe(async ({ request, env }) => {
  const { body, error } = await readJson(request);
  if (error) return error;
  const r = await complete(env.DB, DAILY, body, new Date(), `${new URL(request.url).origin}/`);
  return json(r.body, r.status);
});
