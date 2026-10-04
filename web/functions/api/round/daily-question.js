import { json, safe } from '../../_util.js';
import { dailyQuestion } from '../../_rounds.js';
import { ROUNDS } from '../../_rounds_data.js';

// GET /api/round/daily-question?date= (today or yesterday): the Slack and Discord question of the day.
export const onRequestGet = safe(async ({ request }) => {
  const r = dailyQuestion(ROUNDS, new URL(request.url).searchParams.get('date'), new Date());
  return json(r.body, r.status, { 'cache-control': 'no-store' });
});
