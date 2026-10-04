import { json, safe, readJson } from '../_util.js';
import { recordEvent } from '../_rounds.js';

// POST /api/event {type: share|challenge_view|play_again, anon_id?, round_id?}: one anonymous counter per day and type.
export const onRequestPost = safe(async ({ request, env }) => {
  const { body, error } = await readJson(request);
  if (error) return error;
  const r = await recordEvent(env.DB, body, new Date());
  return json(r.body, r.status);
});
