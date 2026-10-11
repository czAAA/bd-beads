import type { Env } from './env'

/**
 * One named limit. `windowSeconds` is 10 or 60 when the Workers Rate Limiting binding serves it, since a binding's
 * period is fixed in the config; the D1 fallback takes any window.
 */
export interface RateLimitRule {
  name: string
  limit: number
  windowSeconds: number
}

/** Whether one hit is allowed, and when to try again if not. */
export interface RateLimitVerdict {
  allowed: boolean
  /** Seconds until the caller may try again; 0 when allowed. */
  retryAfter: number
  /** True when the D1 fallback served it, which wrote a row (the usage counter wants to know). */
  wroteRow?: boolean
}

interface RateLimitBinding {
  limit(options: { key: string }): Promise<{ success: boolean }>
}

/** The Wrangler `ratelimits` binding that serves a rule: `view-links-create` -> `RATE_LIMIT_VIEW_LINKS_CREATE`. */
function bindingName(rule: RateLimitRule): string {
  return `RATE_LIMIT_${rule.name.toUpperCase().replace(/[^A-Z0-9]/g, '_')}`
}

/**
 * Counts a hit for `key` under `rule` and says whether it is allowed. Uses the rule's Rate Limiting binding when the
 * config declares one (then the binding's own limit and period apply), otherwise a fixed-window counter in D1 (spec
 * 385: "where Free offers it, otherwise a per-key counter in D1"). Each feature ticket sets its own numbers.
 */
export async function checkRateLimit(
  env: Env,
  rule: RateLimitRule,
  key: string,
  now = Date.now(),
): Promise<RateLimitVerdict> {
  const binding = (env as unknown as Record<string, RateLimitBinding | undefined>)[bindingName(rule)]
  if (binding) {
    const { success } = await binding.limit({ key })
    return { allowed: success, retryAfter: success ? 0 : rule.windowSeconds }
  }
  const windowMs = rule.windowSeconds * 1000
  const windowStart = Math.floor(now / windowMs) * windowMs
  const row = await env.DB.prepare(
    'INSERT INTO rate_limits (key, window_start, count) VALUES (?1, ?2, 1) ' +
      'ON CONFLICT (key) DO UPDATE SET ' +
      'count = CASE WHEN window_start = excluded.window_start THEN count + 1 ELSE 1 END, ' +
      'window_start = excluded.window_start ' +
      'RETURNING count',
  )
    .bind(`${rule.name}:${key}`, windowStart)
    .first<{ count: number }>()
  const allowed = (row?.count ?? 1) <= rule.limit
  const retryAfter = allowed ? 0 : Math.max(1, Math.ceil((windowStart + windowMs - now) / 1000))
  return { allowed, retryAfter, wroteRow: true }
}

/** Drops the D1 fallback's windows older than `before` (epoch ms); the watchdog calls it once a day. */
export async function pruneRateLimits(db: D1Database, before: number): Promise<void> {
  await db.prepare('DELETE FROM rate_limits WHERE window_start < ?').bind(before).run()
}
