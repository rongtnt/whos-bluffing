// The challenge page (GET /c/:round_id/:player): the site's page template (scripts/page.html, bundled by sync-items as
// functions/_page.json) with per-link Open Graph tags, a hero naming the challenger, and the app, which plays the
// same round and then shows the side-by-side. A Function response, so public/_headers does not apply: the same
// security headers are set here (test/rounds.test.js checks they match).
import { typeName } from '../public/types.js';

export const HEADERS = {
  'content-type': 'text/html; charset=utf-8',
  'cache-control': 'no-store',
  'content-security-policy': "default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data: blob:; connect-src 'self'; object-src 'none'; base-uri 'none'; form-action 'self'; frame-ancestors 'none'",
  'x-content-type-options': 'nosniff',
  'referrer-policy': 'no-referrer',
};

export const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
export const PLAY_ICON ='<svg class="i i-fill" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M8 5.6v12.8a.6.6 0 0 0 .92.5l10.08-6.4a.6.6 0 0 0 0-1L8.92 5.1a.6.6 0 0 0-.92.5z"/></svg>';

export const challengeTitle = (nickname, score) => `${nickname || 'Someone'} scored ${score}. Can you beat them?`;
// The type as players read it (public/types.js); the stored play keeps the API's name.
export const challengeDescription = (type, accuracy, meanConf) =>
  `${typeName(type)}: ${Math.round(accuracy)}% right at ${Math.round(meanConf)}% sure. Play the same ten questions on Who's Bluffing.`;

// play: {round_id, public_token, nickname, score, type, accuracy, mean_conf}
export function challengePage(template, play) {
  const title = challengeTitle(play.nickname, play.score);
  const description = challengeDescription(play.type, play.accuracy, play.mean_conf);
  const main = `<section class="hero" aria-labelledby="hero-title">
  <div class="wrap">
    <p class="eyebrow">A challenge</p>
    <h1 id="hero-title">${esc(title)}</h1>
    <p class="hero-sub">${esc(description)}</p>
    <div class="actions"><button class="primary" id="play" type="button" data-play>${PLAY_ICON}<span>Play</span></button></div>
    <p class="fine">About a minute. Anonymous: no account, no tracking. Your answers go into a public research dataset.</p>
  </div>
</section>
<div id="app"></div>
<noscript><p class="wrap">The game needs JavaScript.</p></noscript>`;
  const fill = { title: esc(title), description: esc(description), path: `/c/${play.round_id}/${play.public_token}`, main };
  return template
    .replace(/\{\{(title|description|path|main)\}\}/g, (m, key) => fill[key])
    .replace('<link rel="stylesheet"', '<meta name="robots" content="noindex">\n<link rel="stylesheet"')
    .replace('<script src="/site.js"></script>', '<script src="/site.js"></script>\n<script type="module" src="/app.js"></script>');
}
