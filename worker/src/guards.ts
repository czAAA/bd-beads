import type { Guard, RequestContext } from './api'
import { databaseSize } from './d1'
import { MB, numberVar } from './env'
import { ApiError } from './errors'

/** The header the app sends its Turnstile token in; a JSON or binary body has no room for it. */
const TURNSTILE_HEADER = 'X-Turnstile-Token'

const SITEVERIFY_URL = 'https://challenges.cloudflare.com/turnstile/v0/siteverify'

/**
 * Refuses with `403 turnstile-failed` unless the request carries a Turnstile token Cloudflare confirms. Spec 385 puts
 * it on sign-up, sign-in and making a View link, never on sync (a token is single-use and lasts 300 seconds). An
 * unreachable verifier or a missing secret refuses too: it fails closed.
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
    } catch (error) {
      console.error('Turnstile could not be verified', error)
    }
    if (!success) throw new ApiError('turnstile-failed')
  }
}

/**
 * Refuses with `413 too-large` (and the cap) a body over `cap` bytes: at once when its declared length says so,
 * before anything is read, and otherwise as the streamed bytes pass it (`readBody` and the stores, body.ts). `cap` may
 * depend on the request (the owner's plan).
 */
export function sizeCap(cap: (rc: RequestContext) => number): Guard {
  return (rc) => {
    const bytes = cap(rc)
    rc.bodyCap = bytes
    const declared = Number(rc.request.headers.get('Content-Length') ?? Number.NaN)
    if (declared > bytes) throw new ApiError('too-large', { cap: bytes })
  }
}

/**
 * Refuses with `507 storage-full` an upload to the blobs database once it is past `BLOBS_STORAGE_LIMIT_MB`, a little
 * under D1's own 500 MB, so deletes and the writes that keep a View link alive still fit (spec 385). Put it only on
 * routes that add to that database: deletes and expiry are never refused, and R2 has no such limit.
 */
export function blobStorageLimit(): Guard {
  return async ({ env }) => {
    const limit = numberVar(env, 'BLOBS_STORAGE_LIMIT_MB') * MB
    // The size is read just before the write, so one upload may end a little past the limit; the next is refused. A
    // limit that isn't a number refuses: the safe reading of a mistyped dashboard variable.
    if (!(await databaseSize(env.BLOBS_DB) <= limit)) throw new ApiError('storage-full')
  }
}

/** The caller's address, as Cloudflare saw it; the per-IP key. */
function byIp(rc: RequestContext): string | null {
  return rc.request.headers.get('CF-Connecting-IP')
}

/** One of the Worker's Rate Limiting bindings, declared under `ratelimits` in `wrangler.jsonc` by the feature ticket. */
export interface RateLimitRule {
  /** The binding's name in `wrangler.jsonc`. */
  binding: string
  /** The binding's period, 10 or 60 seconds, sent back as `Retry-After`. */
  periodSeconds: 10 | 60
}

/**
 * Refuses with `429 rate-limited` (and `Retry-After`) a caller past `rule`'s binding, counted at Cloudflare's edge
 * with no D1 write. `key` is what is counted: the address by default, an account id where the feature has one; a
 * request with no key shares one bucket, so hiding the address doesn't get around it. Each feature ticket sets its
 * own numbers in the binding. If Workers Free offers no binding (step A2 finds out), an environment without it lets
 * every request through, and per-IP limits wait for the domain's WAF rule (spec 385, ticket 391).
 */
export function rateLimit(rule: RateLimitRule, key: (rc: RequestContext) => string | null = byIp): Guard {
  return async (rc) => {
    const binding = (rc.env as unknown as Record<string, RateLimit | undefined>)[rule.binding]
    if (!binding) return
    const { success } = await binding.limit({ key: key(rc) ?? 'unknown' })
    if (!success) throw new ApiError('rate-limited', {}, rule.periodSeconds)
  }
}
