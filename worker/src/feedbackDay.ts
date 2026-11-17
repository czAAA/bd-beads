import { numberVar, type Env } from './env'

// The day's count of Reports (ticket 1051): one row per UTC day in `core`. The per-minute limits stop a burst; this
// stops a slow flood, which would otherwise fill the docs repo with issues under every warn level.

/** The UTC day of `now`, as the table keys it. */
function dayOf(now: Date): string {
  return now.toISOString().slice(0, 10)
}

/** Counts one more Report for today and says whether it is within `FEEDBACK_DAILY_LIMIT`. One statement, so two
 * Reports at once can't both take the last place; past the limit it writes nothing, so a flood costs no rows. A limit
 * that isn't a number refuses: the safe reading of a mistyped dashboard variable. */
export async function takeReport(env: Env, now: Date): Promise<boolean> {
  const limit = numberVar(env, 'FEEDBACK_DAILY_LIMIT')
  if (!(limit >= 0)) return false
  const row = await env.CORE.prepare(
    `INSERT INTO feedback_days (day, reports) VALUES (?1, 1)
     ON CONFLICT (day) DO UPDATE SET reports = reports + 1 WHERE reports <= ?2
     RETURNING reports`,
  )
    .bind(dayOf(now), limit)
    .first<{ reports: number }>()
  return row !== null && row.reports <= limit
}

/** Today's count, for the watchdog: the limit plus one once a Report was refused. */
export async function reportsToday(env: Env, now: Date): Promise<number> {
  const row = await env.CORE.prepare('SELECT reports FROM feedback_days WHERE day = ?1').bind(dayOf(now)).first<{ reports: number }>()
  return row?.reports ?? 0
}
