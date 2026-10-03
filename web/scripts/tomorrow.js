// npm run tomorrow [-- YYYY-MM-DD]: prints tomorrow's (UTC) five daily items with answers and sources, for the
// nightly review. To swap an item, replace its id in daily/schedule.json, then npm run sync-items and deploy.
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { addDays, dayNumber, todayUTC, isDate } from '../functions/_daily.js';

const fmt = (value, unit) => (unit === 'year' ? String(value) : `${value.toLocaleString('en-US', { maximumFractionDigits: 3 })} ${unit}`);

// Returns the printable review for one date (throws if nothing is scheduled).
export function review(pool, schedule, date) {
  const ids = schedule[date];
  if (!ids) throw new Error(`nothing scheduled for ${date}: run npm run schedule`);
  const items = new Map(pool.map((i) => [i.id, i]));
  const lines = [`HowSure #${dayNumber(date)} · ${date} (UTC)`, ''];
  ids.forEach((id, k) => {
    const it = items.get(id);
    if (!it) throw new Error(`${id} (${date}) is not in items/pool.json`);
    lines.push(`${k + 1}. ${id} [${it.category}] ${it.en.prompt}`, `   answer: ${fmt(it.answer, it.en.unit)}`, `   source: ${it.source}`, '');
  });
  lines.push('Swap an item: replace its id in daily/schedule.json, then npm run sync-items and deploy.');
  return lines.join('\n');
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const root = new URL('../../', import.meta.url);
  const date = process.argv[2] ?? addDays(todayUTC(), 1);
  try {
    if (!isDate(date)) throw new Error('date must be YYYY-MM-DD');
    const pool = JSON.parse(readFileSync(new URL('items/pool.json', root), 'utf8')).items;
    const schedule = JSON.parse(readFileSync(new URL('daily/schedule.json', root), 'utf8'));
    console.log(review(pool, schedule, date));
  } catch (e) {
    console.error(`tomorrow: ${e.message}`);
    process.exit(1);
  }
}
