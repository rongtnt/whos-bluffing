import * as api from './api.js';
import * as store from './party-store.js';
import * as game from './game.js';

const EXPIRED = 'This party has ended. Start a new one with /bluff party.';
const BUSY = 'That action is still finishing. Try the button again in a moment.';
const deny = (text) => { throw Object.assign(new Error(text), { publicMessage: text }); };
const nonce = () => crypto.randomUUID().replaceAll('-', '');
const safeName = (name) => String(name || 'A friend').replace(/[\p{Cc}\p{Cf}]/gu, '').slice(0, 32) || 'A friend';

// Called only after the stored chat scope and interaction message have been checked.
// Guild/channel ids come from this signed interaction, never from a button or new stored fields.
function lobbyLink(p, i) {
  const channel = i.channel?.id ?? i.channel_id;
  if (i.context != null && i.context !== 0) return null;
  return [i.guild_id, channel, p.message_id].every((id) => typeof id === 'string' && /^\d+$/.test(id))
    ? `https://discord.com/channels/${i.guild_id}/${channel}/${p.message_id}` : null;
}

async function active(env, id, scope) {
  if (!/^[\w-]{1,64}$/.test(id ?? '')) deny(EXPIRED);
  const p = await store.get(env.DB, id);
  if (!p || p.scope !== scope || p.expires_at <= Date.now()) deny(EXPIRED);
  return p;
}

async function ready(env, p, rematch) {
  if (p.round_id) return p;
  const lease = nonce();
  if (!(await store.claimRound(env.DB, p.id, lease, Date.now()))) deny(BUSY);
  try {
    const r = await api.quickRound(env, { pack: p.pack, difficulty: p.difficulty, ...(rematch && { rematch }) });
    // Store only public question fields, never API-added truth or answer keys.
    const items = api.roundItems(r);
    if ((r.pack && r.pack !== p.pack) || (r.difficulty && r.difficulty !== p.difficulty)) throw new Error('party settings changed');
    await store.saveRound(env.DB, p.id, lease, { round_id: r.round_id, items });
    return store.get(env.DB, p.id);
  } catch (err) {
    await store.releaseRound(env.DB, p.id, lease);
    throw err;
  }
}

const lobby = async (env, p) => game.partyLobby(p, await store.board(env.DB, p.id));

export async function start(env, i, scope, settings) {
  await store.create(env.DB, i.id, scope, null, Date.now(), settings);
  const p = await ready(env, await active(env, i.id, scope));
  return {
    message: await lobby(env, p),
    afterEdit: async (message) => {
      if (message?.flags & 64) deny('Discord only allows private app replies here. Start /bluff party in a DM, group DM or channel that allows public app replies.');
      if (!message?.id) throw new Error('lobby message missing');
      await store.bindMessage(env.DB, p.id, message.id);
    },
  };
}

function view(p, player) {
  if (player.done) return game.partyDone(p, player);
  if (player.last_result) return player.last_result;
  const state = { ...p, round_id: p.id, total: player.total };
  if (player.step >= p.items.length) deny('Use See your score to finish this round.');
  const msg = game.playQuestion(state, player.step, 't');
  msg.content = `**${game.settingsLabel(p)} party · ${game.esc(player.name)}**\n${msg.content}`;
  return msg;
}

// Join creates a NEW ephemeral response, while Results/Rematch edit the PUBLIC lobby through their own tokens.
export async function publicAction(env, i, kind, id, { scope, me, name }) {
  let p = await active(env, id, scope);
  if (!p.message_id || p.message_id !== i.message?.id || (i.message.flags & 64)) deny('Use the buttons on this chat’s party lobby.');
  p.lobby_url = lobbyLink(p, i);
  if (p.next_id) {
    if (kind === 'tj') deny('A rematch has started. Join from the latest party lobby. Your original round can still finish privately.');
    // Concurrent presses of the previous Rematch converge on the same child, including after a failed API request.
    while (p.next_id) {
      const next = p.next_id;
      await store.create(env.DB, next, scope, p.message_id, Date.now(), p);
      p = await ready(env, await active(env, next, scope), p.round_id);
    }
    return lobby(env, p);
  }
  if (kind === 'tj') {
    if (!p.round_id) deny(BUSY);
    const player = await store.join(env.DB, p.id, me.anon_id, safeName(name), Date.now());
    return {
      message: view(p, player),
      afterEdit: async (message) => {
        if (!message?.id) throw new Error('private party message missing');
        await store.bindPlayerMessage(env.DB, p.id, me.anon_id, message.id);
      },
    };
  }
  if (kind === 'tr') return lobby(env, p);
  const player = await store.player(env.DB, p.id, me.anon_id);
  if (!player?.done) deny('Finish this party’s ten questions before starting its rematch.');
  await store.setNext(env.DB, p.id, nonce());
  const parent = await store.get(env.DB, p.id);
  await store.create(env.DB, parent.next_id, scope, p.message_id, Date.now(), p);
  return lobby(env, await ready(env, await active(env, parent.next_id, scope), p.round_id));
}

export async function privateAction(env, i, kind, args, { scope, me }) {
  const [id, stepText, choiceText, confText] = args;
  const p = await active(env, id, scope);
  let player = await store.player(env.DB, p.id, me.anon_id);
  if (!player || player.message_id !== i.message?.id || !(i.message.flags & 64)) deny('Press Join / Resume on the party lobby to open your own round.');
  p.lobby_url = lobbyLink(p, i);
  if (kind === 'tv') {
    if (!player.done) deny('Finish your round to compare results.');
    return game.partyResults(p, await store.board(env.DB, p.id));
  }
  if (kind === 'tf' || kind === 'tg') {
    const step = Number(stepText);
    if (!Number.isInteger(step) || step !== player.step - 1 || !player.last_result) deny('Report a question from its answer screen.');
    if (kind === 'tf') return game.feedback(p.id, step, 't');
    if (choiceText === 'cancel') return player.last_result;
    if (!['wrong', 'ambiguous', 'unit'].includes(choiceText)) deny('Choose one of the feedback buttons.');
    await api.flag(env, { anon_id: me.anon_id, round_id: p.round_id, item_id: p.items[step].id, reason: choiceText });
    return { ...player.last_result, content: player.last_result.content + '\nThanks — reported for review.' };
  }
  if (player.done) return game.partyDone(p, player);
  const step = Number(stepText);
  if (!/^\d+$/.test(stepText ?? '') || step !== player.step) return view(p, player);
  const state = { ...p, round_id: p.id, total: player.total };
  if (kind === 'tb') {
    if (player.lease_until > Date.now()) deny(BUSY);
    return view(p, player);
  }
  if (kind === 'ta' || kind === 'tc') {
    if (player.last_result || step >= p.items.length) return view(p, player);
    if (!['0', '1'].includes(choiceText)) deny('Please use one of the answer buttons.');
    const choice = Number(choiceText);
    if (kind === 'ta') return game.playConfidence(state, step, choice, 't');
    if (!['50', '60', '70', '80', '90', '100'].includes(confText)) deny('Please use one of the confidence buttons.');
    const lease = nonce();
    if (!(await store.claimPlayer(env.DB, p.id, me.anon_id, step, lease, Date.now()))) deny(BUSY);
    try {
      const res = await api.answer(env, {
        ...me, round_id: p.round_id, item_id: p.items[step].id, choice, conf: Number(confText), rt_ms: Math.max(0, Date.now() - player.updated_at),
      });
      if (!Number.isFinite(res.points) || typeof res.correct !== 'boolean' || !res.truth) throw new Error('answer response incomplete');
      const total = Math.round(res.total ?? player.total + res.points);
      // The API's first saved choice wins even when a response was lost and a retry chose another button.
      const result = game.playResult({ ...state, total }, step, res.choice ?? choice, res.conf ?? Number(confText), res, 't');
      await store.saveAnswer(env.DB, p.id, me.anon_id, lease, total, result);
      return result;
    } catch (err) {
      await store.releasePlayer(env.DB, p.id, me.anon_id, lease);
      throw err;
    }
  }
  if (step < p.items.length) {
    await store.nextQuestion(env.DB, p.id, me.anon_id, step, Date.now());
    return view(p, await store.player(env.DB, p.id, me.anon_id));
  }
  const lease = nonce();
  if (!(await store.claimPlayer(env.DB, p.id, me.anon_id, step, lease, Date.now()))) deny(BUSY);
  try {
    const done = await api.complete(env, { ...me, round_id: p.round_id });
    if (!Number.isFinite(done.score) || !Number.isFinite(done.accuracy) || !Number.isFinite(done.mean_conf)) throw new Error('score response incomplete');
    await store.finish(env.DB, p.id, me.anon_id, lease, done);
    player = await store.player(env.DB, p.id, me.anon_id);
    return game.partyDone(p, player);
  } catch (err) {
    await store.releasePlayer(env.DB, p.id, me.anon_id, lease);
    throw err;
  }
}
