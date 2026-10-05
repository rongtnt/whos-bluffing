import { HEADERS } from './_challenge.js';
import { boardView, boardPage } from './_dares.js';
import { ROUNDS } from './_rounds_data.js';
import page from './_page.json';

const CACHED = { ...HEADERS, 'cache-control': 'public, max-age=60' };

// GET /dares: the dare board, most played first. Cached 60 s per data centre.
export async function onRequestGet({ request, env, waitUntil }) {
  try {
    const key = new Request(new URL('/dares', request.url).toString());
    const cached = await caches.default.match(key);
    if (cached) return cached;
    const r = await boardView(env.DB, ROUNDS, new Date());
    const res = new Response(boardPage(page.html, r.body, ROUNDS.dares), { headers: CACHED });
    waitUntil(caches.default.put(key, res.clone()));
    return res;
  } catch (err) {
    console.error(err);
    return new Response('Something went wrong. Try again later.', { status: 500, headers: { 'content-type': 'text/plain; charset=utf-8' } });
  }
}
