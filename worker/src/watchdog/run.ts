import { utcDay } from '../day'
import { disabledFeatures, forgetSwitches, type FeatureName } from '../features'
import type { Env } from '../env'
import { pruneRateLimits } from '../rateLimit'
import { formatValue, stateOf, type MeasureLevels } from './levels'
import type { Heartbeat, Notifier } from './notifier'
import type { UsageReader } from './usage'

/** What one watchdog run needs; `scheduledWatchdog` builds it from the Worker's environment. */
export interface WatchdogDeps {
  env: Env
  usage: UsageReader
  notifier: Notifier
  heartbeat: Heartbeat
  levels: MeasureLevels[]
  now: number
}

async function getState(db: D1Database, key: string): Promise<string | null> {
  const row = await db.prepare('SELECT value FROM watchdog_state WHERE key = ?').bind(key).first<{ value: string }>()
  return row?.value ?? null
}

function setState(db: D1Database, key: string, value: string): D1PreparedStatement {
  return db
    .prepare('INSERT INTO watchdog_state (key, value) VALUES (?, ?) ON CONFLICT (key) DO UPDATE SET value = excluded.value')
    .bind(key, value)
}

/**
 * The first run of a UTC day lifts what the watchdog switched off yesterday (Cloudflare's daily caps have just reset),
 * forgets yesterday's warnings and stale rate-limit windows, and says what it lifted. The maintainer's switches, in
 * the `DISABLED_FEATURES` variable, are never touched. Keyed on the stored day, not the clock time, so a missed
 * 00:00 run is made up by the next one.
 */
async function startNewDay(deps: WatchdogDeps, day: string): Promise<string | null> {
  const { DB: db, WORKER_NAME: name } = deps.env
  const lifted = await db
    .prepare("SELECT feature FROM switches WHERE source = 'watchdog' ORDER BY set_at")
    .all<{ feature: string }>()
  await db.batch([
    db.prepare("DELETE FROM switches WHERE source = 'watchdog'"),
    db.prepare("DELETE FROM watchdog_state WHERE key LIKE 'notice:%'"),
    setState(db, 'reset_day', day),
  ])
  await pruneRateLimits(db, deps.now - 24 * 60 * 60 * 1000)
  forgetSwitches()
  if (lifted.results.length === 0) return null
  const names = lifted.results.map((row) => row.feature).join(', ')
  return `bd-beads ${name}: new UTC day, the daily caps have reset. Switched back on: ${names}.`
}

/** A message to send, and what to remember once it has gone out. */
interface Notice {
  text: string
  sent?: () => Promise<unknown>
}

/**
 * One scheduled run (spec 385, "The watchdog"): reset on a new day, read today's usage, warn once a day per measure
 * past its warn level, and past a stop level switch off the next feature in that measure's order (one step per run, so
 * the most exposed feature goes first and a later run goes further only if usage is still over; measures that
 * share features escalate together). Every switch is
 * written before any message is sent, and a message that can't be sent doesn't stop the others, so a Telegram
 * outage can't leave a feature running; the run then fails, which Healthchecks.io hears.
 */
export async function runWatchdog(deps: WatchdogDeps): Promise<void> {
  const { env, notifier, now } = deps
  const worker = env.WORKER_NAME
  const day = utcDay(now)
  try {
    const notices: Notice[] = []
    if ((await getState(env.DB, 'reset_day')) !== day) {
      const lifted = await startNewDay(deps, day)
      if (lifted) notices.push({ text: lifted })
    }

    const usage = await deps.usage.read(day)
    const switchedNow = new Set<FeatureName>()
    for (const level of deps.levels) {
      const value = usage[level.measure]
      if (value === undefined) continue
      const state = stateOf(level, value)
      if (state === 'ok') continue
      const shown = formatValue(value, level.unit)

      const noticeKey = `notice:${level.measure}:warn`
      if ((await getState(env.DB, noticeKey)) === null) {
        notices.push({
          text: `bd-beads ${worker}: ${level.measure} today is ${shown}, past the warn level ${formatValue(level.warn, level.unit)}.`,
          sent: () => setState(env.DB, noticeKey, String(now)).run(),
        })
      }

      // Measures that share features (requests and writes) escalate together, one step per run.
      if (state !== 'stop' || level.stop === undefined || level.stops.some((feature) => switchedNow.has(feature))) continue
      const off = await disabledFeatures(env)
      const next = level.stops.find((feature) => !off.has(feature))
      if (!next) continue
      await switchOff(env.DB, next, `${level.measure} ${Math.round(value)} >= ${Math.round(level.stop)}`, now)
      switchedNow.add(next)
      const following = level.stops.find((feature) => feature !== next && !off.has(feature))
      notices.push({
        text:
          `bd-beads ${worker}: ${level.measure} today is ${shown}, past the stop level ` +
          `${formatValue(level.stop, level.unit)}. Switched off ${next} until 00:00 UTC.` +
          (following ? ` If it stays over, ${following} is next.` : ''),
      })
    }

    let failure: unknown = null
    for (const notice of notices) {
      try {
        await notifier.notify(notice.text)
        await notice.sent?.()
      } catch (error) {
        failure ??= error
      }
    }
    if (failure) throw failure
    await deps.heartbeat.ok()
  } catch (error) {
    // Silence must mean "all fine": tell Healthchecks.io the run failed, and Telegram if it can be reached.
    await deps.heartbeat.fail().catch(() => {})
    await notifier
      .notify(`bd-beads ${worker}: the watchdog run failed: ${error instanceof Error ? error.message : String(error)}`)
      .catch(() => {})
    throw error
  }
}

async function switchOff(db: D1Database, feature: FeatureName, reason: string, now: number): Promise<void> {
  await db
    .prepare(
      "INSERT INTO switches (feature, reason, set_at, source) VALUES (?, ?, ?, 'watchdog') " +
        'ON CONFLICT (feature) DO UPDATE SET reason = excluded.reason, set_at = excluded.set_at',
    )
    .bind(feature, reason, now)
    .run()
  forgetSwitches()
}
