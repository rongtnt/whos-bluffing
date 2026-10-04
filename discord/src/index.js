// Who's Bluffing for Discord: the interactions endpoint, the install redirect, and the hourly tick
// (reveal what is due, Monday recaps, then the daily question for servers whose hour has come).

import { verifyDiscord } from './verify.js';
import * as api from './api.js';
import * as store from './store.js';
import { isoDate } from './game.js';
import { handleInteraction, installUrl, logError, postQuestion, postRecap, revealPost } from './commands.js';

const MAX_BODY = 1 << 20;
const MONDAY = 1;
const CHANNEL_GONE = new Set([403, 404]);

const textResponse = (body, status = 200) => new Response(body, { status, headers: { 'content-type': 'text/plain; charset=utf-8' } });

async function interactions(request, env, ctx) {
  if (Number(request.headers.get('content-length') ?? 0) > MAX_BODY) return textResponse('Too large', 413);
  const raw = await request.text();
  const h = request.headers;
  // Discord checks the endpoint with deliberately bad signatures and expects 401.
  if (!(await verifyDiscord(env.DISCORD_PUBLIC_KEY, h.get('x-signature-timestamp'), h.get('x-signature-ed25519'), raw))) {
    return textResponse('Invalid request signature', 401);
  }
  let interaction;
  try {
    interaction = JSON.parse(raw);
  } catch {
    return textResponse('Bad request', 400); // not logged: parse errors quote the input
  }
  if (interaction.type === 1) return Response.json({ type: 1 }); // PING -> PONG
  return handleInteraction(interaction, env, ctx);
}

// ---- Hourly tick --------------------------------------------------------------------------------------------

async function revealDue(env, now) {
  for (const post of await store.duePosts(env.DB, now.toISOString())) {
    await revealPost(env, post).catch((err) => logError('reveal', err));
  }
}

// ponytail: best effort, a failed recap is not retried that week.
async function recapDue(env, now) {
  if (now.getUTCDay() !== MONDAY) return;
  const date = isoDate(now);
  for (const install of await store.recapInstalls(env.DB, date, now.getUTCHours())) {
    if (!(await store.claimRecap(env.DB, install.guild_id, date))) continue;
    await postRecap(env, install, date).catch((err) => logError('recap', err));
  }
}

// ponytail: sequential posts, fine for a few thousand servers per run; batch them if the run gets long.
async function postDue(env, now) {
  const date = isoDate(now);
  const due = await store.dueInstalls(env.DB, date, now.getUTCHours());
  if (!due.length) return;
  const q = await api.dailyQuestion(env, date);
  for (const install of due) {
    const result = await postQuestion(env, install, install.channel_id, date, q, now).catch((err) => logError('post', err));
    // The channel is gone or Who's Bluffing lost access: stop posting until someone runs /bluff setup again.
    if (CHANNEL_GONE.has(result?.status)) await store.clearChannel(env.DB, install.guild_id);
  }
}

async function tick(env, now) {
  for (const [name, step] of [['reveal', revealDue], ['recap', recapDue], ['post', postDue]]) {
    await step(env, now).catch((err) => logError(name, err));
  }
}

export default {
  async fetch(request, env, ctx) {
    try {
      const { pathname } = new URL(request.url);
      const route = `${request.method} ${pathname}`;
      if (route === 'POST /interactions') return await interactions(request, env, ctx);
      if (route === 'GET /install') return Response.redirect(installUrl(env), 302);
      return textResponse('Not found', 404);
    } catch (err) {
      logError('request', err);
      return textResponse('Something went wrong.', 500);
    }
  },

  async scheduled(controller, env, ctx) {
    ctx.waitUntil(tick(env, new Date(controller.scheduledTime)));
  },
};
