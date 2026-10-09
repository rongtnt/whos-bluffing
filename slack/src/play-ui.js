import { PACKS, DIFFICULTY_LABELS } from '../../web/public/packs.js';
import { typeName } from '../../web/public/types.js';
import AVAILABILITY from '../../web/public/pack-availability.json' with { type: 'json' };
import { CONFS } from './game.js';

export const esc = (s) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const text = (s) => ({ type: 'plain_text', text: String(s).slice(0, 75) });
const section = (s) => ({ type: 'section', text: { type: 'mrkdwn', text: s.slice(0, 3000), verbatim: true } });
const actions = (...elements) => ({ type: 'actions', elements });
const button = (op, label, id, extra = '') => ({ type: 'button', action_id: `play:${op}:${id}${extra ? ':' + extra : ''}`, text: text(label), value: id });
const message = (fallback, ...blocks) => ({ text: fallback, blocks, unfurl_links: false, unfurl_media: false, parse: 'none' });
const label = (p) => `${PACKS[p.pack].label} · ${DIFFICULTY_LABELS[p.difficulty]}`;
const option = (pack, difficulty) => ({ text: text(`${PACKS[pack].label} · ${DIFFICULTY_LABELS[difficulty]}`), value: `${pack}:${difficulty}` });
export const validSettings = (pack, difficulty) => Object.hasOwn(AVAILABILITY, difficulty) && AVAILABILITY[difficulty].includes(pack);
export function chooser(p) {
  return message("Who's Bluffing? Choose your round.", section(`*Who's Bluffing?* · ${p.kind === 'party' ? 'Play with friends' : 'Play solo'}\nTen questions. Pick an answer, then say how sure you are.`), {
    type: 'actions', block_id: 'play-settings', elements: [{
      type: 'static_select', action_id: 'play:settings', placeholder: text('Topic and difficulty'),
      initial_option: option(p.pack, p.difficulty),
      option_groups: Object.entries(AVAILABILITY).map(([difficulty, packs]) => ({ label: text(DIFFICULTY_LABELS[difficulty]), options: packs.map((pack) => option(pack, difficulty)) })),
    }],
  }, actions(button('start', p.kind === 'party' ? 'Start a party' : 'Start playing', p.id)));
}
export function question(p, me, choice) {
  const it = p.items[me.step];
  const header = `*${esc(label(p))}* · Question ${me.step + 1} of 10 · ${Math.round(me.total)} points`;
  const prompt = `${header}\n${esc(it.prompt)}\n*A:* ${esc(it.a)}\n*B:* ${esc(it.b)}`;
  return choice == null
    ? message(`Question ${me.step + 1} of 10: ${it.prompt}`, section(prompt), actions(...[0, 1].map((c) => button('pick', `${c ? 'B' : 'A'} · ${c ? it.b : it.a}`, p.id, `${me.step}:${c}`))))
    : message('How sure are you?', section(`${prompt}\nYou picked *${choice ? 'B' : 'A'}*. How sure are you?`), actions(...CONFS.map((conf) => button('conf', `${conf}%`, p.id, `${me.step}:${choice}:${conf}`)), button('back', 'Change answer', p.id, String(me.step))));
}
function source(raw) {
  try {
    const u = new URL(raw);
    if (!['https:', 'http:'].includes(u.protocol)) return '';
    return ` <${u.href.replace(/[<>|]/g, encodeURIComponent)}|source>`;
  } catch { return ''; }
}
export function feedback(p, me, step, choice, conf, result) {
  const it = p.items[step], t = result.truth ?? {};
  const lines = [
    `*Question ${step + 1} of 10* · ${esc(it.prompt)}`,
    `${result.correct ? 'Right' : 'Wrong'} at ${conf}% sure · *${Math.round(result.points)} points* · total ${Math.round(me.total)}`,
    ...['a', 'b'].map((side) => `${side.toUpperCase()}: ${esc(it[side])} — ${esc(t[side + '_value'])}${t.unit ? ' ' + esc(t.unit) : ''}${source(t[side + '_source'])}`),
    ...(t.fun ? [esc(t.fun)] : []),
  ];
  return message(`${result.correct ? 'Right' : 'Wrong'} at ${conf}% sure. ${Math.round(result.points)} points.`, section(lines.join('\n')), actions(button('next', step === 9 ? 'See your score' : 'Next', p.id, String(step + 1)), button('report', 'Report question', p.id, String(step))));
}
export function challengeUrl(raw, round) {
  try {
    const u = new URL(raw, 'https://whosbluffing.com');
    if (!['whosbluffing.com', 'bots.whosbluffing.com'].includes(u.hostname) || u.protocol !== 'https:' || u.username || u.password || u.port) return null;
    const parts = /^\/c\/([^/]+)\/([a-zA-Z0-9_-]+)$/.exec(u.pathname);
    return parts?.[1] === round && !u.search && !u.hash ? `https://whosbluffing.com${u.pathname}` : null;
  } catch { return null; }
}
export function end(p, me) {
  const d = me.done;
  const buttons = p.kind === 'solo'
    ? [button('replay', 'Play again', p.id), ...(challengeUrl(d.challenge_url, p.round_id) ? [button('share', 'Challenge friends here', p.id)] : [])]
    : [button('board', 'Check friends', p.id), button('rematch', 'Rematch', p.id)];
  const link = p.kind === 'solo' && challengeUrl(d.challenge_url, p.round_id);
  return message(`${Math.round(d.score)} points · ${typeName(d.type)}`, section(`*${Math.round(d.score)} points · ${esc(typeName(d.type))}*\n${Math.round(d.accuracy)}% right at ${Math.round(d.mean_conf)}% sure.\n${esc(label(p))}${d.roast ? '\n' + esc(d.roast) : ''}`),
    ...(link ? [section(`<${link}|Open challenge link> — your friends get the same ten questions.`)] : [section('Your finished score is available in the party lobby. Answers stay private.')]), actions(...buttons));
}
export const finishing = (p) => message('Your answers are saved. See your score.', section('Your ten answers are saved.'), actions(button('next', 'See your score', p.id, '10')));
export function lobby(p, board) {
  const scores = board.top.map((me, i) => `${i + 1}. ${esc(me.name)} · ${Math.round(me.score)} points`);
  return message(`Who's Bluffing? ${label(p)} party — join for the same ten questions.`,
    section(`*Who's Bluffing? · ${esc(label(p))} party*\nSame ten questions. Pick A or B, then say how sure you are. Your answers stay private.\n*Join shares your Slack display name and finished score here.*\n${board.joined} joined · ${board.finished} finished · expires <!date^${Math.floor(p.expires_at / 1000)}^{time}|in one hour>.`),
    section(scores.length ? `*Finished scores* (Results refreshes this list)\n${scores.join('\n')}${board.finished > 10 ? `\nTop 10 of ${board.finished}.` : ''}` : 'Nobody has finished yet.'),
    section('Finish to start a rematch with new questions. Friends still playing can finish their original round privately.'),
    actions(button('join', 'Join / Resume', p.id), button('board', 'Results', p.id), button('rematch', 'Rematch', p.id)));
}
export const shared = (name, done, url) => message(`${name} scored ${Math.round(done.score)} points. Can you beat that?`, section(`${esc(name)} scored *${Math.round(done.score)} points* in Who's Bluffing?\nCan you beat that? Same ten questions: <${url}|Play their challenge>`));
export const notice = (s) => message(s, section(esc(s)));
export const REPORT_REASONS = { wrong: 'The answer seems wrong', unclear: 'The question is unclear', source: 'The source needs checking' };
export const reportPicker = (p, step) => message('What needs checking?', section(`*Question ${step + 1}:* ${esc(p.items[step].prompt)}\nWhat needs checking? Your game stays in the message above.`),
  actions(...Object.entries(REPORT_REASONS).map(([reason, label]) => button('flag', label, p.id, `${step}:${reason}`))));
