import * as api from './api.js';
import * as state from './play-store.js';
import * as ui from './play-ui.js';
import { CONFS, CANT_POST } from './game.js';

const EXPIRED = 'This round has expired. Start a fresh one with /bluff play or /bluff party.';
const BUSY = 'That tap is still saving. Try the same button again in a moment.';
const nonce = () => crypto.randomUUID().replaceAll('-', '');
const safeName = (s) => String(s || 'A friend').replace(/[\p{Cc}\p{Cf}]/gu, '').trim().slice(0, 32) || 'A friend';
const identity = async (env, team, user, channel) => ({
  anon: await api.anonId(env, team, user),
  scope: await api.playId(env, team, `channel:${channel}`),
  community: await api.communityId(env, team),
});
const view = (p, me) => me.done ? ui.end(p, me) : me.feedback || (me.step < 10 ? ui.question(p, me) : ui.finishing(p));
const validRound = (r) => typeof r?.round_id === 'string' && r.items?.length === 10 && new Set(r.items.map((it) => it.id)).size === 10 && r.items.every((it) => ['id', 'prompt', 'a', 'b'].every((k) => typeof it[k] === 'string' && it[k].length > 0));
const failSend = (res) => { if (!res.ok || !res.ts) throw new Error(CANT_POST); };

export async function start(env, install, f, kind, transport) {
  if (!f.user_id || !f.channel_id || !f.trigger_id) throw new Error('missing command context');
  const who = await identity(env, install.team_id, f.user_id, f.channel_id);
  // Slack retries the same command with the same trigger; do not make another session.
  const id = (await api.playId(env, install.team_id, `command:${f.trigger_id}`)).slice(0, 32);
  await state.create(env.DB, { id, kind, scope: who.scope, owner: who.anon, pack: kind === 'solo' ? 'all' : 'memes' }, Date.now());
  const p = await state.get(env.DB, id);
  if (p.expires_at <= Date.now()) return transport.reply(f.response_url, ui.notice(EXPIRED));
  const me = p.round_id && await state.player(env.DB, id, who.anon);
  return transport.reply(f.response_url, me ? view(p, me) : ui.chooser(p));
}

async function ready(env, install, p, channel, settings, transport) {
  const lease = nonce();
  if (!await state.claimSession(env.DB, p.id, lease, Date.now())) return null;
  try {
    p = await state.get(env.DB, p.id);
    if (!p.round_id) {
      const [pack, difficulty] = settings ?? [p.pack, p.difficulty];
      if (!ui.validSettings(pack, difficulty)) throw new Error('unsupported topic and difficulty');
      const round = await api.quickRound(env, { pack, difficulty, ...(p.parent_round && { rematch: p.parent_round }) });
      if (!validRound(round)) throw new Error('incomplete round');
      // Persist only playable questions. Never put answer truth in the public lobby.
      const items = round.items.map(({ id, prompt, a, b }) => ({ id, prompt, a, b }));
      await state.saveRound(env.DB, p.id, lease, { round_id: round.round_id, items }, pack, difficulty);
      p = await state.get(env.DB, p.id);
    }
    if (p.kind === 'party' && !p.lobby_ts) {
      const res = await transport.slack(install.bot_token, 'chat.postMessage', { channel, ...ui.lobby(p, await state.board(env.DB, p.id)) });
      failSend(res);
      await state.bindLobby(env.DB, p.id, lease, res.ts);
      p = await state.get(env.DB, p.id);
    }
    return p;
  } finally { await state.releaseSession(env.DB, p.id, lease); }
}

async function nameFor(install, user, fallback, transport) {
  const info = await transport.slack(install.bot_token, 'users.info', { user }).catch(() => null);
  return safeName(info?.user?.profile?.display_name || info?.user?.real_name || info?.user?.name || fallback);
}
async function updateLobby(env, install, p, channel, transport) {
  const res = await transport.slack(install.bot_token, 'chat.update', { channel, ts: p.lobby_ts, ...ui.lobby(p, await state.board(env.DB, p.id)) });
  if (!res.ok) throw new Error(CANT_POST);
}

export async function action(env, install, payload, transport) {
  const [prefix, op, id, stepText, choiceText, confText] = String(payload.actions?.[0]?.action_id ?? '').split(':');
  if (prefix !== 'play' || op === 'settings') return;
  const privateMessage = payload.container?.is_ephemeral === true;
  // Never replace a public lobby with a private answer/result, even on malformed callbacks.
  const respond = (msg) => transport.reply(payload.response_url, { ...msg, replace_original: privateMessage });
  // Add notices alongside the game: a slow or failed concurrent request must leave retry buttons intact.
  const notice = (s) => transport.reply(payload.response_url, { ...ui.notice(s), replace_original: false });
  if (!/^[a-f0-9]{32}$/.test(id ?? '') || !payload.user?.id || !payload.channel?.id) return notice(EXPIRED);
  const who = await identity(env, install.team_id, payload.user.id, payload.channel.id);
  let p = await state.get(env.DB, id);
  if (!p || p.scope !== who.scope || p.expires_at <= Date.now()) return notice(EXPIRED);
  if (p.kind === 'solo' && p.owner !== who.anon) return notice('Start your own round with /bluff play.');
  const publicMessage = !privateMessage && p.lobby_ts && (payload.container?.message_ts ?? payload.message?.ts) === p.lobby_ts;
  if (!privateMessage && !publicMessage) return notice('Use the buttons on the current round.');
  if (op === 'start') {
    if (!privateMessage || p.owner !== who.anon) return notice('Only the person who opened this picker can start it.');
    const selected = payload.state?.values?.['play-settings']?.['play:settings']?.selected_option?.value;
    p = await ready(env, install, p, payload.channel.id, selected?.split(':'), transport);
    if (!p) return notice(BUSY);
    if (p.kind === 'party') return notice('Your party is ready in this channel. Tap Join in its lobby to play.');
    const me = await state.join(env.DB, p.id, who.anon, '', Date.now());
    return respond(view(p, me));
  }
  if (!p.round_id) return notice('Choose a topic and start the round first.');
  if (['join', 'board', 'rematch'].includes(op) && p.kind === 'party') {
    if (op === 'join' && !publicMessage) return notice('Join from the public party lobby so your friends can see the shared round.');
    const original = p;
    // Old retry callbacks converge on the existing shared rematch instead of creating more rounds.
    let hops = 0;
    while (p.next_id && hops++ < 20) {
      // A retry can arrive after linking a child but before its INSERT finished.
      await state.create(env.DB, { ...p, id: p.next_id, parent_round: p.round_id }, Date.now());
      const next = await state.get(env.DB, p.next_id);
      if (!next || next.scope !== who.scope || next.expires_at <= Date.now()) return notice(EXPIRED);
      p = next;
    }
    if (p.next_id) return notice('Use the latest party lobby.');
    if (op === 'rematch' && original.id === p.id) {
      const me = await state.player(env.DB, p.id, who.anon);
      if (!me?.done) return notice('Finish this round before starting a rematch.');
      await state.setNext(env.DB, p.id, nonce());
      p = await state.get(env.DB, p.id);
      await state.create(env.DB, { ...p, id: p.next_id, parent_round: p.round_id }, Date.now());
      p = await state.get(env.DB, p.next_id);
    }
    p = await ready(env, install, p, payload.channel.id, null, transport);
    if (!p) return notice(BUSY);
    if (op === 'join') {
      let me = await state.player(env.DB, p.id, who.anon);
      if (!me) me = await state.join(env.DB, p.id, who.anon, await nameFor(install, payload.user.id, payload.user.name, transport), Date.now());
      // One response to this click's new response_url; no old URLs are retained or reused.
      return respond(view(p, me));
    }
    await updateLobby(env, install, p, payload.channel.id, transport);
    return notice(op === 'rematch' ? 'The rematch is ready. Join the new round in the party lobby.' : 'Finished scores are updated in the party lobby.');
  }
  if (!privateMessage) return notice('Answer using your private game buttons.');
  let me = await state.player(env.DB, p.id, who.anon);
  if (!me) return notice('Tap Join in the party lobby first.');
  if (op === 'report' || op === 'flag') {
    const step = /^\d+$/.test(stepText ?? '') ? Number(stepText) : -1;
    if (step < 0 || step >= me.step || step >= p.items.length) return notice('Answer this question before reporting it.');
    if (op === 'report') return transport.reply(payload.response_url, { ...ui.reportPicker(p, step), replace_original: false });
    if (!Object.hasOwn(ui.REPORT_REASONS, choiceText)) return notice('Choose a reason from the report buttons.');
    await api.flag(env, { round_id: p.round_id, item_id: p.items[step].id, anon_id: who.anon, reason: ui.REPORT_REASONS[choiceText] });
    return respond(ui.notice('Thanks. Your report was sent for review. Continue in your game message.'));
  }
  if (op === 'replay' && p.kind === 'solo') {
    if (!me.done) return respond(view(p, me));
    await state.setNext(env.DB, p.id, nonce());
    p = await state.get(env.DB, p.id);
    await state.create(env.DB, { ...p, id: p.next_id, parent_round: p.round_id }, Date.now());
    p = await ready(env, install, await state.get(env.DB, p.next_id), payload.channel.id, null, transport);
    if (!p) return notice(BUSY);
    me = await state.join(env.DB, p.id, who.anon, '', Date.now());
    return respond(view(p, me));
  }
  if (op === 'share' && p.kind === 'solo' && me.done) {
    const url = ui.challengeUrl(me.done.challenge_url, p.round_id);
    if (!url) return notice('The challenge link is unavailable. Try again in a moment.');
    if (!await state.claimShare(env.DB, p.id, who.anon)) return notice('This challenge is already shared in this channel.');
    try {
      const name = await nameFor(install, payload.user.id, payload.user.name, transport);
      failSend(await transport.slack(install.bot_token, 'chat.postMessage', { channel: payload.channel.id, ...ui.shared(name, me.done, url) }));
    } catch (err) { await state.releaseShare(env.DB, p.id, who.anon); throw err; }
    return respond(view(p, me));
  }
  if (me.done) return respond(view(p, me));
  const step = /^\d+$/.test(stepText ?? '') ? Number(stepText) : -1;
  if (step !== me.step) return respond(view(p, me));
  if (op === 'pick' && !me.feedback && step < 10 && ['0', '1'].includes(choiceText)) return respond(ui.question(p, me, Number(choiceText)));
  if (op === 'conf' && !me.feedback && step < 10 && ['0', '1'].includes(choiceText) && CONFS.includes(Number(confText))) {
    const lease = nonce();
    if (!await state.claimPlayer(env.DB, p.id, who.anon, step, lease, Date.now())) return notice(BUSY);
    try {
      const result = await api.answer(env, { round_id: p.round_id, item_id: p.items[step].id, anon_id: who.anon, community: who.community, choice: Number(choiceText), conf: Number(confText), rt_ms: Math.max(0, Date.now() - me.updated_at) });
      if (!Number.isFinite(result.points) || !Number.isFinite(result.total) || typeof result.correct !== 'boolean' || ![0, 1].includes(result.choice) || !CONFS.includes(result.conf)) throw new Error('incomplete answer');
      const feedback = ui.feedback(p, { ...me, total: result.total }, step, result.choice, result.conf, result);
      await state.saveAnswer(env.DB, p.id, who.anon, lease, result.total, feedback);
      return respond(feedback);
    } catch (err) { await state.releasePlayer(env.DB, p.id, who.anon, lease); throw err; }
  }
  if (op === 'next') {
    await state.next(env.DB, p.id, who.anon, step, Date.now());
    me = await state.player(env.DB, p.id, who.anon);
    if (step === 10) {
      const lease = nonce();
      if (!await state.claimPlayer(env.DB, p.id, who.anon, step, lease, Date.now())) return notice(BUSY);
      try {
        const done = await api.complete(env, { round_id: p.round_id, anon_id: who.anon, community: who.community });
        if (!Number.isFinite(done.score) || !Number.isFinite(done.accuracy) || !Number.isFinite(done.mean_conf) || typeof done.type !== 'string') throw new Error('incomplete result');
        await state.finish(env.DB, p.id, who.anon, lease, done);
        me = await state.player(env.DB, p.id, who.anon);
      } catch (err) { await state.releasePlayer(env.DB, p.id, who.anon, lease); throw err; }
    }
  }
  return respond(view(p, me));
}
