import { challengePage, HEADERS } from '../../_challenge.js';
import { countEvent, parseRoundId, TOKEN_RE } from '../../_rounds.js';
import page from '../../_page.json';

const PLAY_SQL = 'SELECT round_id, public_token, nickname, score, type, accuracy, mean_conf FROM round_plays WHERE public_token = ?';

// GET /c/:round_id/:player: the challenge page, or the branded 404 for an unknown link. Each page load counts one
// anonymous challenge_view.
export async function onRequestGet({ request, env, params, waitUntil }) {
  const notFound = async () => {
    const res = await env.ASSETS.fetch(new URL('/404', request.url)); // Pages redirects /404.html to /404
    return new Response(res.body, { status: 404, headers: HEADERS });
  };
  try {
    const r = parseRoundId(params.round_id);
    if (!r || r.kind === 'question' || !TOKEN_RE.test(params.player)) return notFound();
    const play = await env.DB.prepare(PLAY_SQL).bind(params.player).first();
    if (!play || play.round_id !== params.round_id) return notFound();
    waitUntil(countEvent(env.DB, 'challenge_view', new Date()));
    return new Response(challengePage(page.html, play), { headers: HEADERS });
  } catch (err) {
    console.error(err);
    return new Response('Something went wrong. Try again later.', { status: 500, headers: { 'content-type': 'text/plain; charset=utf-8' } });
  }
}
