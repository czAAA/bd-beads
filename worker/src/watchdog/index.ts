import type { Env } from '../env'
import { usageSource, type Measure } from '../usageCounters'
import { FREE_LEVELS, scaleLevels } from './levels'
import { healthchecksHeartbeat, telegramNotifier } from './notifier'
import { runWatchdog } from './run'
import { d1UsageReader, graphqlUsageReader } from './usage'

/** The measures whose count costs a D1 write of its own when the Worker keeps the counters itself. */
const COUNTED_BY_WRITING: Measure[] = ['requests', 'd1-rows-written']

/**
 * The watchdog for this Worker's environment, run by its 15-minute Cron Trigger. With the D1 counters as the usage
 * source every counted request costs a write, so the request and write levels count against half the cap (spec 385);
 * storage and email levels are unaffected. `WATCHDOG_LEVEL_FACTOR` lowers every level further, to try the alerts on dev.
 */
export function scheduledWatchdog(env: Env, scheduledTime: number): Promise<void> {
  const source = usageSource(env)
  const halved = source === 'd1' ? scaleLevels(FREE_LEVELS, 0.5, COUNTED_BY_WRITING) : FREE_LEVELS
  return runWatchdog({
    env,
    usage: source === 'graphql' ? graphqlUsageReader(env) : d1UsageReader(env.DB),
    notifier: telegramNotifier(env),
    heartbeat: healthchecksHeartbeat(env),
    levels: scaleLevels(halved, Number(env.WATCHDOG_LEVEL_FACTOR) || 1),
    now: scheduledTime,
  })
}
