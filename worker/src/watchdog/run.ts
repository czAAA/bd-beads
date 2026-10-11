import { databaseSize } from '../d1'
import type { Env } from '../env'
import { graphqlUsageReader, type UsageReader } from './analytics'
import { healthchecksHeartbeat, type Heartbeat } from './heartbeat'
import { checkLevels, type Usage } from './levels'

/** Work done once a day, on the first watchdog run after 00:00 UTC (ticket 323's View link cleanup). */
export type DailyHook = (env: Env, now: Date) => Promise<void>

/** What a run reads from and reports to, behind interfaces so the tests can stand in for Cloudflare and Healthchecks. */
export interface WatchdogDeps {
  analytics: UsageReader
  heartbeat: Heartbeat
  daily: DailyHook[]
}

/** The Cron Trigger's interval in `wrangler.jsonc`; the run inside the day's first interval is the daily one. */
const CRON_INTERVAL_MINUTES = 15

/** The production dependencies: Cloudflare's GraphQL Analytics and this Worker's Healthchecks.io check. */
export function watchdogDeps(env: Env, daily: DailyHook[]): WatchdogDeps {
  return { analytics: graphqlUsageReader(env), heartbeat: healthchecksHeartbeat(env.HEALTHCHECK_URL), daily }
}

function message(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}

/**
 * One watchdog run (spec 385): today's usage from the analytics and the databases' sizes from D1, each against this
 * Worker's warn levels, then a success ping when all are under and every step worked, or a `/fail` ping whose report
 * names the Worker, each measure over its level with its value and level, and any step that failed. On the first run
 * after 00:00 UTC it also runs the daily hooks. It only warns: nothing is switched off, and no state is kept.
 */
export async function runWatchdog(env: Env, scheduledTime: number, deps: WatchdogDeps): Promise<void> {
  const now = new Date(scheduledTime)
  const midnight = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()))
  const failures: string[] = []
  const usage: Usage = {}

  try {
    Object.assign(usage, await deps.analytics.read(midnight, now))
  } catch (error) {
    failures.push(`Usage could not be read from Cloudflare's analytics: ${message(error)}`)
  }
  for (const [measure, db] of [['core-db', env.CORE], ['blobs-db', env.BLOBS_DB]] as const) {
    try {
      usage[measure] = await databaseSize(db)
    } catch (error) {
      failures.push(`The ${measure === 'core-db' ? 'core' : 'blobs'} database's size could not be read: ${message(error)}`)
    }
  }
  if (now.getTime() - midnight.getTime() < CRON_INTERVAL_MINUTES * 60_000) {
    for (const hook of deps.daily) {
      try {
        await hook(env, now)
      } catch (error) {
        failures.push(`The daily work failed: ${message(error)}`)
      }
    }
  }

  const readings = checkLevels(env, usage)
  const over = readings.filter((reading) => reading.over)
  const report = [
    `bd-beads watchdog, ${env.WORKER_NAME} Worker, ${now.toISOString().slice(0, 16).replace('T', ' ')} UTC`,
    ...(over.length ? ['', 'Over its warn level:', ...over.map((reading) => `- ${reading.line}`)] : []),
    ...(failures.length ? ['', 'Failed:', ...failures.map((failure) => `- ${failure}`)] : []),
    '',
    'All readings:',
    ...readings.map((reading) => `- ${reading.line}`),
  ].join('\n')
  if (over.length || failures.length) await deps.heartbeat.fail(report)
  else await deps.heartbeat.success(report)
}
