// The dare board's picker (briefs/BRIEF_dares.md), run by sync-items.js. For each dare in dares/dares.json it picks ten
// pairs from items/pairs.json at the dare's pack and difficulty (the pairs a quick round there may draw, in its mix of
// levels, and Normal's one lesser-known pair), deterministically: candidates are shuffled by a hash of the slug, pairs
// naming a keyword first. Rules: at least KEYWORD_FLOOR pairs with an item whose name contains one of the dare's
// keywords (case-insensitive), the rest from the same pack; both items referenced or fact-checked; no volatile item or
// pair; no item twice; never the home page's example pair, a drama item (ai_drama, pol_drama) whose name still carries a
// date, or a pair of a ranked day or chat question in daily/rounds.json (a dare must not show them early).
// The picks are written into dares.json (`items`) once and then kept: a fixed round must not change under its players,
// so later runs check them and fail loudly when one breaks a rule (empty `items` to pick again). A dare that cannot be
// filled is reported and left off the board. Writes functions/_dares.json: the dares on the board, the fields the
// runtime reads.
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { loadRounds, DIFFICULTIES, LEVELS, PACKS, hash } from '../functions/_rounds.js';
import { SLUG_RE } from '../functions/_dares.js';
import { isDate } from '../functions/_daily.js';

export const ROUND_SIZE = 10;
export const KEYWORD_FLOOR = 5;
export const EXAMPLE_PAIR = 'p36637'; // the home page's example: ChatGPT (released) vs Anthropic (founded)
export const STATUSES = ['open', 'played', 'declined', 'removed'];
export const PRONOUNS = ['he', 'she', 'they'];
// Members of Congress carry `party` (an independent also `caucus`, the party they sit with) and their congress.gov
// `bioguide` id; the board shows them in equal numbers per side (sideOf), so a filled dare of the bigger side waits.
export const MEMBER_PARTIES = ['democrat', 'republican', 'independent'];
export const SIDES = ['democrat', 'republican'];
export const sideOf = (d) => d.caucus ?? d.party;
// A date in a name: a year, a month followed by a number, or a day followed by a month.
const MON = '(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)';
export const DATED = new RegExp(`\\b(?:19|20)\\d{2}\\b|\\b${MON}[a-z]*\\.? \\d|\\b\\d{1,2} ${MON}`);
const MAX_STEPS = 200000; // depth-first search budget per dare
const HTTPS = /^https:\/\/\S+$/;
// A portrait (optional): web/public/img/dares/<slug>.jpg with the credit its licence asks for, under a free licence only.
export const FREE_LICENSE = /^(public domain|CC0( 1\.0)?|CC BY(-SA)? \d\.\d( [a-z]{2})?)$/i;
const PUBLIC = new URL('../public/', import.meta.url);
const DARES = new URL('../../dares/dares.json', import.meta.url);
const BUNDLE = new URL('../functions/_dares.json', import.meta.url);

const text = (x) => typeof x === 'string' && x.trim() !== '';
const isObject = (x) => x !== null && typeof x === 'object' && !Array.isArray(x);
const scoreOk = (s) => isObject(s) && Number.isInteger(s.score) && s.score >= -3000 && s.score <= 1000 && s.score % 4 === 0
  && HTTPS.test(s.url ?? '') && isDate(s.date);

// Problems with the hand-edited file itself; any one stops the build.
export function seedErrors(dares) {
  if (!Array.isArray(dares)) return ['dares.json must be an array'];
  const slugs = new Set(dares.map((d) => d?.slug));
  const seen = new Set();
  const errs = [];
  for (const d of dares) {
    const e = (msg) => errs.push(`${d?.slug ?? '?'}: ${msg}`);
    if (!isObject(d)) { e('must be an object'); continue; }
    if (!SLUG_RE.test(d.slug ?? '')) e('bad slug');
    else if (seen.has(d.slug)) e('duplicate slug');
    seen.add(d.slug);
    for (const k of ['name', 'address', 'org']) if (!text(d[k])) e(`missing ${k}`);
    if (d.topic != null && !text(d.topic)) e('topic must be text');
    if (d.pronoun != null && !PRONOUNS.includes(d.pronoun)) e('pronoun must be he, she or they');
    if (d.party != null && !MEMBER_PARTIES.includes(d.party)) e('party must be democrat, republican or independent');
    if ((d.party === 'independent') !== (d.caucus != null) || (d.caucus != null && !SIDES.includes(d.caucus))) e('an independent (only) needs caucus: democrat or republican');
    if (d.party != null && !/^[A-Z]\d{6}$/.test(d.bioguide ?? '')) e('a member of Congress needs their congress.gov bioguide id');
    if (!Object.hasOwn(PACKS, d.pack ?? '')) e('unknown pack');
    if (!Object.hasOwn(DIFFICULTIES, d.difficulty ?? '')) e('difficulty must be easy, normal or brutal');
    if (!Array.isArray(d.keywords) || !d.keywords.length || !d.keywords.every(text)) e('keywords must be a list of words');
    if (d.rival != null && (d.rival === d.slug || !slugs.has(d.rival))) e('rival must be another dare');
    if (!isDate(d.issued)) e('issued must be YYYY-MM-DD');
    if (d.dare_url != null && !HTTPS.test(d.dare_url)) e('dare_url must be an https URL or null');
    if (!STATUSES.includes(d.status)) e(`status must be one of ${STATUSES.join(', ')}`);
    if (d.status === 'played' && !scoreOk(d.their_score)) e('a played dare needs their_score {score, url, date}');
    if (d.status !== 'played' && d.their_score != null) e('their_score only when status is played');
    if (d.items != null && !(Array.isArray(d.items) && d.items.every((id) => typeof id === 'string'))) e('items must be a list of pair ids');
    if (d.avatar != null && (d.avatar !== `/img/dares/${d.slug}.jpg` || !existsSync(new URL(d.avatar.slice(1), PUBLIC)))) e('avatar must be /img/dares/<slug>.jpg, a file in web/public');
    if (d.avatar != null && !(isObject(d.credit) && HTTPS.test(d.credit.source_url ?? '') && text(d.credit.author) && FREE_LICENSE.test(d.credit.license ?? ''))) {
      e('an avatar needs credit {source_url (https), author, license (public domain, CC0, CC BY or CC BY-SA)}');
    }
    if (d.avatar == null && d.credit != null) e('credit only with an avatar');
  }
  return errs;
}

// What the rules read: the runtime's pack lists plus the item and pair fields the runtime bundle leaves out.
export function dareContext({ pool, doc, rounds, data }) {
  return {
    data,
    items: new Map(pool.items.map((i) => [i.id, i])),
    pairs: new Map(doc.pairs.map((p) => [p.id, p])),
    ranked: new Set(Object.values(rounds).flatMap((day) => [...day.ranked, day.question])),
  };
}

const itemOk = (i) => (i.ref_quality === 'referenced' || i.fact_checked === true) && !i.volatile && !(/_drama$/.test(i.category) && DATED.test(i.name ?? ''));

// The pairs a dare may use, in its order: pairs naming one keyword item, then two (they spend two), then the rest of
// the pack; each group shuffled by the slug. An item is its name (lower case): two records of one model, say its
// parameters and its compute, are the same item to a player. kwItems: the distinct items naming a keyword.
function candidates(dare, ctx) {
  const spec = DIFFICULTIES[dare.difficulty];
  const keys = dare.keywords.map((k) => k.toLowerCase());
  const cands = [];
  for (const level of LEVELS.filter((l) => spec.mix[l])) {
    for (const id of ctx.data.packLists[dare.pack][dare.difficulty][level]) {
      const p = ctx.pairs.get(id);
      const [a, b] = [ctx.items.get(p.a_id), ctx.items.get(p.b_id)];
      if (id === EXAMPLE_PAIR || p.volatile || ctx.ranked.has(id) || !itemOk(a) || !itemOk(b)) continue;
      const names = [a.name.toLowerCase(), b.name.toLowerCase()];
      cands.push({ id, names, level, band: ctx.data.pairs.get(id).band, kw: names.filter((n) => keys.some((k) => n.includes(k))) });
    }
  }
  const group = (c) => (c.kw.length === 1 ? 0 : c.kw.length === 2 ? 1 : 2);
  cands.sort((x, y) => group(x) - group(y) || hash(`${dare.slug}|${x.id}`) - hash(`${dare.slug}|${y.id}`));
  return { spec, cands, kwItems: new Set(cands.flatMap((c) => c.kw)) };
}

// Can c join the picked pairs? No item twice, the difficulty's mix of levels, Normal's one pair under 50,000 views.
function fits(picked, c, spec) {
  if (picked.some((x) => x.names.some((n) => c.names.includes(n)))) return false;
  if (picked.filter((x) => x.level === c.level).length >= spec.mix[c.level]) return false;
  return spec.maxKnown == null || c.band === 2 || picked.filter((x) => x.band < 2).length < spec.maxKnown;
}

// The first ten in candidate order (depth first) that fit together with at least KEYWORD_FLOOR keyword pairs, or null.
function search(cands, spec) {
  const picked = [];
  let steps = 0;
  const go = (start, kw) => {
    if (picked.length === ROUND_SIZE) return kw >= KEYWORD_FLOOR;
    if (KEYWORD_FLOOR - kw > ROUND_SIZE - picked.length) return false;
    for (let k = start; k < cands.length && steps < MAX_STEPS; k += 1) {
      steps += 1;
      const c = cands[k];
      if (!c.kw.length && kw < KEYWORD_FLOOR) return false; // keyword pairs come first: none left for the floor
      if (!fits(picked, c, spec)) continue;
      picked.push(c);
      if (go(k + 1, kw + (c.kw.length ? 1 : 0))) return true;
      picked.pop();
    }
    return false;
  };
  return go(0, 0) ? picked.map((c) => c.id) : null;
}

// {items} or {error}: why the dare cannot be filled.
export function pickDare(dare, ctx) {
  const { spec, cands, kwItems } = candidates(dare, ctx);
  const where = `the ${PACKS[dare.pack].label} pack (${dare.difficulty})`;
  const n = kwItems.size;
  if (n < KEYWORD_FLOOR) {
    const which = n ? `only ${n} usable item${n === 1 ? '' : 's'} in ${where} name${n === 1 ? 's' : ''}` : `no usable item in ${where} names`;
    return { error: `${which} a keyword (${dare.keywords.join(', ')}); ${KEYWORD_FLOOR} keyword pairs need ${KEYWORD_FLOOR} such items, as no item may appear twice` };
  }
  const items = search(cands, spec);
  return items ? { items } : { error: `no ${ROUND_SIZE} pairs in ${where} meet every rule with ${KEYWORD_FLOOR} keyword pairs` };
}

// Problems with a dare's kept picks: each must still be a pair the picker could choose, together.
export function pinnedErrors(dare, ctx) {
  if (dare.items.length !== ROUND_SIZE || new Set(dare.items).size !== ROUND_SIZE) return [`items must be ${ROUND_SIZE} different pair ids`];
  const { spec, cands } = candidates(dare, ctx);
  const by = new Map(cands.map((c) => [c.id, c]));
  const picked = [];
  const errs = [];
  for (const id of dare.items) {
    const c = by.get(id);
    if (!c) errs.push(`${id} is not allowed (not in the pack at this difficulty, or unreferenced, volatile or excluded)`);
    else if (!fits(picked, c, spec)) errs.push(`${id} repeats an item or breaks the mix of levels`);
    if (c) picked.push(c);
  }
  if (picked.filter((c) => c.kw.length).length < KEYWORD_FLOOR) errs.push(`fewer than ${KEYWORD_FLOOR} pairs name a keyword`);
  return errs;
}

// The runtime's copy of a dare on the board (functions/_dares.json).
const compactDare = ({ slug, name, address, org, topic, pronoun, pack, difficulty, rival, issued, dare_url: dareUrl, status, their_score: theirs, avatar, credit, items }) => ({
  slug, name, address, org, ...(topic ? { topic } : {}), pronoun: pronoun ?? 'they', pack, difficulty, rival: rival ?? null, issued,
  dare_url: dareUrl ?? null, status, their_score: theirs ?? null, ...(avatar ? { avatar, credit } : {}), items,
});

// The board's dares with members of Congress in equal numbers per side: the first n of each side in file order, n = the
// smaller side's count. Returns {shown, waiting}.
export function balanced(board) {
  const members = (side) => board.filter((d) => d.party && sideOf(d) === side);
  const n = Math.min(...SIDES.map((side) => members(side).length));
  const waiting = SIDES.flatMap((side) => members(side).slice(n));
  return { shown: board.filter((d) => !waiting.includes(d)), waiting };
}

// {errors, unfilled, dares, compact}: errors stop the build; unfilled ({slug, reason}) are left off the board, with the
// filled dares that wait for the other party's; dares = the file with new picks; compact = the bundle.
export function buildDares(dares, ctx) {
  const errors = seedErrors(dares);
  if (errors.length) return { errors, unfilled: [], dares, compact: [] };
  const unfilled = [];
  const out = dares.map((d) => {
    if (d.status === 'removed') return d;
    if (d.items?.length) {
      pinnedErrors(d, ctx).forEach((m) => errors.push(`${d.slug}: ${m}`));
      return d;
    }
    const r = pickDare(d, ctx);
    if (r.error) unfilled.push({ slug: d.slug, reason: r.error });
    return r.items ? { ...d, items: r.items } : d;
  });
  const { shown, waiting } = balanced(out.filter((d) => d.status !== 'removed' && d.items?.length));
  for (const d of waiting) unfilled.push({ slug: d.slug, reason: 'filled, but waits for one more filled dare of the other party (the board shows members of Congress in equal numbers per party)' });
  return { errors, unfilled, dares: out, compact: shown.map(compactDare) };
}

// Two-space JSON with lists of words on one line, as the owner edits it.
export const pretty = (x) => `${JSON.stringify(x, null, 2).replace(/\[\n\s*("[^\]]*")\n\s*\]/g, (m, inner) => `[${inner.split(/,\n\s*/).join(', ')}]`)}\n`;

// sync-items.js: picks what is missing, writes dares.json (when it changes) and the bundle. Returns buildDares's result.
export function syncDares({ pool, doc, rounds, server, compact }) {
  const file = existsSync(DARES) ? readFileSync(DARES, 'utf8') : null;
  const ctx = dareContext({ pool, doc, rounds, data: loadRounds(server, compact, rounds) });
  const r = buildDares(file ? JSON.parse(file) : [], ctx);
  if (r.errors.length) return r;
  if (file && pretty(r.dares) !== file) writeFileSync(DARES, pretty(r.dares));
  writeFileSync(BUNDLE, JSON.stringify(r.compact));
  return r;
}
