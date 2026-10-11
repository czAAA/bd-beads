import type { Guard, RequestContext } from './api'
import { ApiError } from './errors'
import { checkRateLimit, type RateLimitRule } from './rateLimit'

/** The header the app sends its Turnstile token in; a JSON or binary body has no room for it. */
const TURNSTILE_HEADER = 'X-Turnstile-Token'

const SITEVERIFY_URL = 'https://challenges.cloudflare.com/turnstile/v0/siteverify'

/**
 * Refuses with `403 turnstile-failed` unless the request carries a Turnstile token that Cloudflare confirms. Put it
 * on every route that creates something, so a script reading the open-source frontend can't call the API in a loop.
 * An unreachable verifier or a missing secret refuses too: fail closed.
 */
export function turnstile(): Guard {
  return async (rc) => {
    const { request, env } = rc
    const token = request.headers.get(TURNSTILE_HEADER)
    if (!token || !env.TURNSTILE_SECRET_KEY) throw new ApiError('turnstile-failed')
    const form = new URLSearchParams({ secret: env.TURNSTILE_SECRET_KEY, response: token })
    const ip = byIp(rc)
    if (ip) form.set('remoteip', ip)
    let success = false
    try {
      const response = await fetch(SITEVERIFY_URL, { method: 'POST', body: form })
      success = response.ok && ((await response.json()) as { success?: boolean }).success === true
    } catch {
      success = false
    }
    if (!success) throw new ApiError('turnstile-failed')
  }
}

/**
 * Refuses with `413 too-large` (and the cap) a body over `cap` bytes: at once when its Content-Length says so,
 * before anything is read, and otherwise as `readBody` passes the cap. `cap` may depend on the request (the plan).
 * A handler must read its body with `readBody`; `request.json()` and the like would bypass a streamed body's cap.
 */
export function sizeCap(cap: number | ((rc: RequestContext) => number)): Guard {
  return (rc) => {
    const bytes = typeof cap === 'function' ? cap(rc) : cap
    rc.bodyCap = bytes
    const length = Number(rc.request.headers.get('Content-Length'))
    if (Number.isFinite(length) && length > bytes) throw new ApiError('too-large', { cap: bytes })
  }
}

/** The caller's address, as Cloudflare saw it; the per-IP key. */
export function byIp(rc: RequestContext): string | null {
  return rc.request.headers.get('CF-Connecting-IP')
}

/**
 * Refuses with `429 rate-limited` (and `Retry-After`) a caller past `rule`'s limit. `key` is what is counted: the
 * address by default, an account id where a feature ticket has one. A request with no key (no address) shares
 * one bucket, so hiding the address never gets around the limit.
 */
export function rateLimit(rule: RateLimitRule, key: (rc: RequestContext) => string | null = byIp): Guard {
  return async (rc) => {
    const verdict = await checkRateLimit(rc.env, rule, key(rc) ?? 'unknown')
    if (verdict.wroteRow) rc.rowsWritten += 1
    if (!verdict.allowed) throw new ApiError('rate-limited', { retryAfter: verdict.retryAfter })
  }
}
