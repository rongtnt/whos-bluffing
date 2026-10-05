// Results page: headlines, calibration chart, ranges, percentile, share card.
import { html, pct, signed, num, calibrationChart, chartLabels } from './ui.js';
import { renderShare } from './share.js';

export function headlines(t, res) {
  const n = res.interval_detail.length;
  const k = res.interval_detail.filter((d) => d.hit).length;
  const x = Math.round(res.scores.overconf * 100);
  const conf = x > 0 ? t('results.over_headline', { x }) : x < 0 ? t('results.under_headline', { x: -x }) : t('results.even_headline');
  return { ranges: t('results.int_headline', { k, n }), conf, x };
}

export function showResults(ctx, res, run) {
  const { app, t } = ctx;
  const s = res.scores;
  const h = headlines(t, res);
  const items = new Map(run.session.map((i) => [i.id, i]));
  const range = (d) => {
    const q = items.get(d.id).en;
    const row = t('results.range_row', { low: num(d.low), high: num(d.high), unit: q.unit, truth: num(d.truth) });
    return html`<li><span class="rq">${q.prompt}</span><span>${row} · <b class="${d.hit ? 'hit' : 'miss'}">${d.hit ? '✓' : '✗'} ${t(d.hit ? 'results.hit' : 'results.miss')}</b></span></li>`;
  };
  app.innerHTML = html`<h1>${t('results.title')}</h1>
<p class="headline">${h.ranges}</p>
<p class="muted">${t('results.int_explain')}</p>
<p class="headline">${h.conf}</p>
<p class="muted">${t('results.conf_explain', { c: pct(s.mean_conf), a: pct(s.acc), x: signed(h.x) })}</p>
<figure>${calibrationChart([{ name: t('results.you'), bins: res.bins, cls: 's0' }], chartLabels(t))}<figcaption>${t('results.chart_note')}</figcaption></figure>
${res.percentile ? html`<p>${t('results.pct_over', { p: res.percentile.overconf })} ${t('results.pct_int', { p: res.percentile.int_hit })}</p>` : ''}
<h2>${t('results.ranges_title')}</h2>
<ul class="ranges">${res.interval_detail.map(range)}</ul>
<section id="share" class="card"></section>
<p><a href="/">${t('results.daily_link')}</a> · <a href="/stats">${t('results.stats_link')}</a></p>`;
  window.scrollTo(0, 0);
  renderShare(ctx, app.querySelector('#share'), h);
}
