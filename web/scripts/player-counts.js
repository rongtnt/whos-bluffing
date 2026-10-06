// Owner-only read via the existing Cloudflare CLI login. No admin password belongs in public browser code.
import { execFileSync } from 'node:child_process';
import { PLAYER_COUNTS_SQL } from '../functions/_kpi.js';
import { addDays, todayUTC } from '../functions/_daily.js';

const asOf = todayUTC();
const dates = [asOf, addDays(asOf, -29), addDays(asOf, -364)];
const sql = PLAYER_COUNTS_SQL.replace(/\?([123])/g, (_, n) => `'${dates[Number(n) - 1]}'`);
const result = JSON.parse(execFileSync('npx', ['wrangler', 'd1', 'execute', 'whosbluffing', '--remote', '--command', sql, '--json'],
  { cwd: new URL('../', import.meta.url), encoding: 'utf8', stdio: ['ignore', 'pipe', 'inherit'] }));
console.log(JSON.stringify({ as_of: asOf, ...result[0].results[0] }, null, 2));
