import { utcDay } from './day'
import type { Env } from './env'

/** What the watchdog watches, per UTC day (spec 385, "Levels on Free"). */
export type Measure = 'requests' | 'd1-rows-written' | 'd1-storage' | 'magic-link-emails' | 'r2-storage'

/**
 * Adds to today's counters in D1. Only used while `USAGE_SOURCE` is 'd1', the watchdog's fallback when Cloudflare's
 * analytics aren't available: every counted request costs a write of its own, which is why that reader's levels are
 * halved (watchdog/usage.ts).
 */
export async function bumpUsage(env: Env, amounts: Partial<Record<Measure, number>>, now = Date.now()): Promise<void> {
  const day = utcDay(now)
  const statements = Object.entries(amounts).map(([measure, value]) =>
    env.DB.prepare(
      'INSERT INTO usage_counters (day, measure, value) VALUES (?, ?, ?) ' +
        'ON CONFLICT (day, measure) DO UPDATE SET value = value + excluded.value',
    ).bind(day, measure, value),
  )
  if (statements.length > 0) await env.DB.batch(statements)
}

/** Where the watchdog reads usage from; 'd1' (the Worker's own counters) unless the analytics reader is switched on. */
export function usageSource(env: Env): 'd1' | 'graphql' {
  return env.USAGE_SOURCE === 'graphql' ? 'graphql' : 'd1'
}

/** Whether this Worker keeps its own usage counters (the D1 reader is in use). */
export function countsUsage(env: Env): boolean {
  return usageSource(env) === 'd1'
}
