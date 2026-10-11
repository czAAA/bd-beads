import type { Env } from './env'

/**
 * The features the maintainer or the watchdog can switch off (spec 385, "Kill switches"). `api` is everything under
 * /api except health. A later ticket that adds a feature registers its name here.
 */
export const FEATURES = ['api', 'view-links', 'sign-up', 'sign-in', 'sync', 'magic-link'] as const
export type FeatureName = (typeof FEATURES)[number]

let cached: { readAt: number; features: Set<string> } | null = null

/** Forget the D1 switches read so far; the watchdog calls it after changing them so its own isolate sees them at once. */
export function forgetSwitches(): void {
  cached = null
}

/** The features switched off by the `DISABLED_FEATURES` variable (set in the dashboard, kept across deploys). */
function disabledByVariable(env: Env): Set<string> {
  return new Set((env.DISABLED_FEATURES ?? '').split(',').map((name) => name.trim()).filter(Boolean))
}

/** The features switched off in D1's `switches` table, read at most once per cache window per isolate. */
async function disabledInD1(env: Env, now: number): Promise<Set<string>> {
  const ttl = Number(env.SWITCHES_CACHE_SECONDS ?? 60) * 1000
  if (cached && now - cached.readAt < ttl) return cached.features
  try {
    const { results } = await env.DB.prepare('SELECT feature FROM switches').all<{ feature: string }>()
    cached = { readAt: now, features: new Set(results.map((row) => row.feature)) }
  } catch {
    // D1 unreachable: the variable still works, and the last good read stands until D1 answers again.
    cached = { readAt: now, features: cached?.features ?? new Set() }
  }
  return cached.features
}

/** Every feature that is off, from either source (spec 385: a feature is off when either says so). */
export async function disabledFeatures(env: Env, now = Date.now()): Promise<Set<string>> {
  return new Set([...disabledByVariable(env), ...(await disabledInD1(env, now))])
}
