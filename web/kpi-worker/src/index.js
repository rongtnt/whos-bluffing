// Cron Worker (see wrangler.toml): at 00:10 UTC asks the Pages app to compute the KPIs for the day that just ended.
// env.RUN_URL = https://<site>/api/kpi/run; env.KPI_KEY = the same secret as the Pages project's KPI_KEY.

export const yesterdayUTC = (ms) => new Date(ms - 86400000).toISOString().slice(0, 10);

export async function runKpi(env, scheduledTime) {
  const res = await fetch(`${env.RUN_URL}?as_of=${yesterdayUTC(scheduledTime)}`, {
    method: 'POST',
    headers: { 'x-kpi-key': env.KPI_KEY },
  });
  if (!res.ok) throw new Error(`KPI run failed with status ${res.status}`); // appears in the Worker's cron logs
  return res.json();
}

export default {
  scheduled(controller, env, ctx) {
    ctx.waitUntil(runKpi(env, controller.scheduledTime));
  },
};
