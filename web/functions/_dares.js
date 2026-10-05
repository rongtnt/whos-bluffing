// The dare board (briefs/BRIEF_dares.md): a named public figure's fixed round dr-<slug> (ten pairs picked by
// scripts/build-dares.js from dares/dares.json, bundled as functions/_dares.json and loaded by loadRounds), its page
// /dare/:slug, the board /dares and their reads GET /api/dare/:slug and GET /api/dares. Every number comes from the
// completed plays of the round (round_plays, bounded by round_id through idx_round_plays_round); callers cache 60 s.
// No imports from _rounds.js, which imports this file.
import { esc, PLAY_ICON } from './_challenge.js';

export const SLUG_RE = /^[a-z][a-z0-9-]{1,30}$/;
export const DARE_RE = /^dr-([a-z][a-z0-9-]{1,30})$/;

const ok = (body) => ({ status: 200, body });
const err = (status, error) => ({ status, body: { error } });
const r1 = (x) => (x == null ? null : Math.round(x * 10) / 10);
const qs = (n) => Array(n).fill('?').join(', ');
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
export const fmtDate = (d) => `${Number(d.slice(8, 10))} ${MONTHS[Number(d.slice(5, 7)) - 1]} ${d.slice(0, 4)}`;
const num = (n) => (n < 0 ? `−${(-n).toLocaleString('en-US')}` : n.toLocaleString('en-US'));
const avg = (mean) => (mean == null ? '–' : num(Math.round(mean)));

// A dare that may be shown: known and not removed.
const shown = (data, slug) => {
  const d = slug == null ? null : data.dares.get(slug);
  return d && d.status !== 'removed' ? d : null;
};

// --- copy -----------------------------------------------------------------------------------------------------------

// The share text at the end of a dare round (POST /api/round/complete); host = the site's host, no scheme.
const NOT_YET = { he: "He hasn't taken it yet.", she: "She hasn't taken it yet.", they: "They haven't taken it yet." };
export const dareShareText = (d, score, host) => `I scored ${score} on the ten questions written for ${d.name}. ${
  d.status === 'played' ? `${d.name} scored ${d.their_score.score}.` : NOT_YET[d.pronoun] ?? NOT_YET.they} ${host}/dare/${d.slug}`;

// The named person's status, in the board's only words for it ("no score yet" while the dare is open). HTML, where the
// played line links their post; html: false gives plain text (the page description).
export function statusLine(d, { html = true } = {}) {
  const who = html ? esc(d.address) : d.address;
  if (d.status === 'played') {
    const posted = `posted ${fmtDate(d.their_score.date)}`;
    return `${who}: ${num(d.their_score.score)}, ${html ? `<a href="${esc(d.their_score.url)}" rel="noopener noreferrer">${posted}</a>` : posted}`;
  }
  return d.status === 'declined' ? `${who} declined` : `${who}: no score yet`;
}
export const boardStatus = (d) => (d.status === 'played' ? `posted ${num(d.their_score.score)}` : d.status === 'declined' ? 'declined' : 'no score yet');

const OPT_OUT = 'Public figures only. If your name is here and you would rather it weren’t, write to <a href="mailto:hello@whosbluffing.com">hello@whosbluffing.com</a> and it comes off within a day.';

// --- numbers --------------------------------------------------------------------------------------------------------

const STATS_SQL = 'SELECT COUNT(*) AS players, MAX(score) AS best, AVG(score) AS mean, AVG(overconf) AS overconf FROM round_plays WHERE round_id = ?';

// GET /api/dare/:slug. 400 for a malformed slug, 404 for an unknown or removed dare.
export async function dareView(db, data, slug, now) {
  if (typeof slug !== 'string' || !SLUG_RE.test(slug)) return err(400, 'bad slug');
  const d = shown(data, slug);
  if (!d) return err(404, 'unknown dare');
  const rival = shown(data, d.rival);
  const [mine, theirs] = await db.batch([d, rival].filter(Boolean).map((x) => db.prepare(STATS_SQL).bind(`dr-${x.slug}`)));
  const s = mine.results[0];
  const t = theirs?.results[0];
  return ok({
    slug: d.slug, name: d.name, address: d.address, org: d.org, status: d.status, issued: d.issued, dare_url: d.dare_url,
    players: s.players, best: s.best, mean_score: r1(s.mean), mean_overconfidence: r1(s.overconf), their_score: d.their_score,
    rival: rival ? { slug: rival.slug, address: rival.address, players: t.players, mean_score: r1(t.mean), status: rival.status } : null,
    as_of: now.toISOString(),
  });
}

// GET /api/dares: every dare not removed, most played first (ties keep the order of dares.json).
export async function boardView(db, data, now) {
  const list = [...data.dares.values()].filter((d) => d.status !== 'removed');
  const ids = list.map((d) => `dr-${d.slug}`);
  const rows = ids.length ? (await db.prepare(`SELECT round_id, COUNT(*) AS players, AVG(score) AS mean FROM round_plays
    WHERE round_id IN (${qs(ids.length)}) GROUP BY round_id`).bind(...ids).all()).results : [];
  const by = new Map(rows.map((r) => [r.round_id, r]));
  const dares = list.map((d) => {
    const s = by.get(`dr-${d.slug}`);
    return { slug: d.slug, name: d.name, address: d.address, org: d.org, status: d.status, players: s?.players ?? 0,
      mean_score: r1(s?.mean ?? null), their_score: d.their_score, issued: d.issued };
  });
  return ok({ as_of: now.toISOString(), dares: dares.sort((x, y) => y.players - x.players) });
}

// --- pages (the site's template, scripts/page.html via functions/_page.json, with per-page Open Graph tags) --------

function fill(template, { title, description, path, main }, { app = false } = {}) {
  const v = { title: esc(`${title} | Who's Bluffing?`), description: esc(description), path, main };
  const out = template.replace(/\{\{(title|description|path|main)\}\}/g, (m, key) => v[key]);
  return app ? out.replace('<script src="/site.js"></script>', '<script src="/site.js"></script>\n<script type="module" src="/app.js"></script>') : out;
}

const tile = (n, label) => `<div class="tile"><b>${n}</b><span>${label}</span></div>`;

// v = dareView's body; dares = the bundled dares (the heading's `topic`, which defaults to the org, and the rival's
// status line).
export function darePage(template, v, dares) {
  const h1 = `Ten questions about ${dares.get(v.slug)?.topic ?? v.org}, written for ${v.address}`;
  const rival = v.rival && dares.get(v.rival.slug);
  const rivalCard = rival ? `<div class="card dare-rival"><p><a href="/dare/${v.rival.slug}">${esc(v.rival.address)}’s round</a>: ${num(v.rival.players)} taken${
    v.rival.players ? `, average ${avg(v.rival.mean_score)}` : ''}; ${statusLine(rival)}</p></div>` : '';
  const main = `<section class="hero" aria-labelledby="hero-title">
  <div class="wrap">
    <p class="eyebrow">A dare</p>
    <h1 id="hero-title">${esc(h1)}</h1>
    <p class="hero-sub">Same ten for everyone. Being sure only pays when you're right.</p>
    <div class="tiles dare-tiles">${tile(num(v.players), v.players === 1 ? 'person has taken it' : 'people have taken it')}${tile(v.best == null ? '–' : num(v.best), 'best score')}${tile(avg(v.mean_score), 'average score')}</div>
    <div class="card dare-status"><p>${statusLine(v)}</p>${v.dare_url ? `<p class="fine">Read <a href="${esc(v.dare_url)}" rel="noopener noreferrer">the dare</a> on X.</p>` : ''}</div>
    <div class="actions"><button class="primary" id="play" type="button" data-play>${PLAY_ICON}<span>Play</span></button></div>
    <p class="fine">About a minute. Anonymous: no account, no tracking. Your answers go into a public research dataset.</p>
  </div>
</section>
<div id="app"></div>
<noscript><p class="wrap">The game needs JavaScript.</p></noscript>
<div class="after-app">
  <section class="section dare-more" aria-label="More dares">
    <div class="wrap">
      ${rivalCard}
      <p><a href="/dares">The dare board</a></p>
      <p class="fine">${OPT_OUT}</p>
    </div>
  </section>
</div>`;
  return fill(template, { title: h1, description: `Same ten for everyone. ${statusLine(v, { html: false })}.`, path: `/dare/${v.slug}`, main }, { app: true });
}

// v = boardView's body; dares = the bundled dares (for the link to each one's post on X).
export function boardPage(template, v, dares) {
  const row = (e) => {
    const url = dares.get(e.slug)?.dare_url;
    return `<tr><th scope="row"><a href="/dare/${e.slug}">${esc(e.name)}</a></th><td>${esc(e.org)}</td><td>${num(e.players)}</td><td>${avg(e.mean_score)}</td><td>${boardStatus(e)}</td><td>${
      url ? `<a href="${esc(url)}" rel="noopener noreferrer">the dare</a>` : '–'}</td></tr>`;
  };
  const sentence = 'Each person got ten questions about their own field. Everyone can take the same ten. The board shows who has answered.';
  const main = `<section class="page-head">
  <div class="wrap">
    <h1>The dare board</h1>
    <p class="lead">${sentence}</p>
  </div>
</section>
<section class="section dare-board" aria-label="Dares">
  <div class="wrap">
    <div class="dare-scroll"><table class="vs dare-table">
      <thead><tr><th scope="col">Person</th><th scope="col">Company</th><th scope="col">People who have taken it</th><th scope="col">Average score</th><th scope="col">Status</th><th scope="col">The dare</th></tr></thead>
      <tbody>${v.dares.map(row).join('\n') || '<tr><td colspan="6">No dares yet.</td></tr>'}</tbody>
    </table></div>
    <p class="fine">${OPT_OUT}</p>
  </div>
</section>`;
  return fill(template, { title: 'The dare board', description: sentence, path: '/dares', main });
}
