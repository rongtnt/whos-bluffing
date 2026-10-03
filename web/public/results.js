// Results page: headlines, calibration chart, ranges, percentile, en-vs-zh comparison, re-take CTA, share card.
import { html, api, pct, signed, num, calibrationChart, chartLabels } from './ui.js';
import { renderShare } from './share.js';

export function headlines(t, res) {
  const n = res.interval_detail.length;
  const k = res.interval_detail.filter((d) => d.hit).length;
  const x = Math.round(res.scores.overconf * 100);
  const conf = x > 0 ? t('results.over_headline', { x }) : x < 0 ? t('results.under_headline', { x: -x }) : t('results.even_headline');
  return { ranges: t('results.int_headline', { k, n }), conf, x };
}

async function renderCompare(ctx, el) {
  const { t } = ctx;
  const r = await api('/api/stats');
  if (!r.ok) return;
  const langs = ['en', 'zh'].filter((l) => r.data.by_lang[l].n > 0);
  if (langs.length < 2) return;
  el.innerHTML = html`<h2>${t('results.compare_title')}</h2>
<ul class="plain">${langs.map((l) => {
    const b = r.data.by_lang[l];
    return html`<li>${t('results.compare_row', { lang: t(`meta.lang_${l}`), n: num(b.n, ctx.lang), x: signed(Math.round(b.overconf_mean * 100)), h: pct(b.int_hit_mean) })}</li>`;
  })}</ul>`;
}

// onAgain starts the bilingual re-take (offered once, not after round 2).
export function showResults(ctx, res, run, onAgain) {
  const { app, t, lang } = ctx;
  const s = res.scores;
  const h = headlines(t, res);
  const items = new Map(run.session.map((i) => [i.id, i]));
  const range = (d) => {
    const q = items.get(d.id)[lang];
    const row = t('results.range_row', { low: num(d.low, lang), high: num(d.high, lang), unit: q.unit, truth: num(d.truth, lang) });
    return html`<li><span class="rq">${q.prompt}</span><span>${row} · <b class="${d.hit ? 'hit' : 'miss'}">${d.hit ? '✓' : '✗'} ${t(d.hit ? 'results.hit' : 'results.miss')}</b></span></li>`;
  };
  const g = res.global;
  app.innerHTML = html`<h1>${t('results.title')}</h1>
<p class="headline">${h.ranges}</p>
<p class="muted">${t('results.int_explain')}</p>
<p class="headline">${h.conf}</p>
<p class="muted">${t('results.conf_explain', { c: pct(s.mean_conf), a: pct(s.acc), x: signed(h.x) })}</p>
<figure>${calibrationChart([{ name: t('results.you'), bins: res.bins, cls: 's0' }], chartLabels(t))}<figcaption>${t('results.chart_note')}</figcaption></figure>
${res.percentile ? html`<p>${t('results.pct_over', { p: res.percentile.overconf })} ${t('results.pct_int', { p: res.percentile.int_hit })}</p>` : ''}
<h2>${t('results.ranges_title')}</h2>
<ul class="ranges">${res.interval_detail.map(range)}</ul>
${g.n_sessions > 1 && g.n_countries > 1 ? html`<p class="muted">${t('results.global', { n: num(g.n_sessions, lang), k: g.n_countries })}</p>` : ''}
<div id="compare"></div>
${run.round === 2 ? '' : html`<section class="card"><button id="again" class="block" type="button">${t('results.again')}</button><p class="muted small">${t('results.again_note')}</p></section>`}
<section id="share" class="card"></section>
<p><a href="/stats">${t('results.stats_link')}</a></p>`;
  window.scrollTo(0, 0);
  renderShare(ctx, app.querySelector('#share'), h);
  renderCompare(ctx, app.querySelector('#compare'));
  const again = app.querySelector('#again');
  if (again) again.onclick = onAgain;
}
