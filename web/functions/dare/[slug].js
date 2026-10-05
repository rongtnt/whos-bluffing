import { HEADERS } from '../_challenge.js';
import { SLUG_RE, dareView, darePage } from '../_dares.js';
import { ROUNDS } from '../_rounds_data.js';
import page from '../_page.json';

const CACHED = { ...HEADERS, 'cache-control': 'public, max-age=60' };

// GET /dare/:slug: the dare's page, which plays its fixed round dr-<slug> (public/app.js -> rounds.js renderDare), or
// the branded 404 for an unknown or removed dare. Cached 60 s per data centre and slug. A Function response, so the
// security headers are set here (_challenge.js HEADERS, checked against public/_headers by the tests).
export async function onRequestGet({ request, env, params, waitUntil }) {
  const notFound = async () => {
    const res = await env.ASSETS.fetch(new URL('/404', request.url));
    return new Response(res.body, { status: 404, headers: HEADERS });
  };
  try {
    if (!SLUG_RE.test(params.slug)) return notFound();
    const key = new Request(new URL(`/dare/${params.slug}`, request.url).toString());
    const cached = await caches.default.match(key);
    if (cached) return cached;
    const r = await dareView(env.DB, ROUNDS, params.slug, new Date());
    if (r.status !== 200) return notFound();
    const res = new Response(darePage(page.html, r.body, ROUNDS.dares), { headers: CACHED });
    waitUntil(caches.default.put(key, res.clone()));
    return res;
  } catch (err) {
    console.error(err);
    return new Response('Something went wrong. Try again later.', { status: 500, headers: { 'content-type': 'text/plain; charset=utf-8' } });
  }
}
