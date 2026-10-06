// Host gate. The Slack and Discord workers call the API through a second hostname of this Pages project
// (bots.whosbluffing.com), which the WAF rate limit leaves out (README, Deploy). On a host starting with "bots." only
// /api/* is served, and only with x-bluff-bot = BOT_KEY (constant time; no key configured = nobody). Other hosts pass.
import { json, isBot } from './_util.js';
import { authorized } from './_kpi.js';

export async function onRequest(ctx) {
  const url = new URL(ctx.request.url);
  if (url.hostname.startsWith('bots.')) {
    if (!url.pathname.startsWith('/api/')) return json({ error: 'not found' }, 404);
    if (!(await isBot(ctx.request, ctx.env))) return json({ error: 'bot host requires key' }, 403);
  }
  if (['/api/stats', '/api/daily/stats', '/api/round/stats'].includes(url.pathname.replace(/\/$/, ''))) {
    if (!(await authorized(ctx.request, ctx.env))) return json({ error: 'unauthorized' }, 401, { 'cache-control': 'private, no-store' });
    const upstream = await ctx.next();
    const response = new Response(upstream.body, upstream);
    response.headers.set('cache-control', 'private, no-store');
    response.headers.delete('access-control-allow-origin');
    return response;
  }
  return ctx.next();
}
