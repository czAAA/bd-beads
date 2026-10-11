/**
 * The API's refusals (spec 385, "API contract"). JSON in and out; a refusal is `{"error": "<code>", ...details}` with a
 * stable code the app translates. Every later ticket's routes refuse through these and invent no codes of their own.
 */
export type ApiErrorCode =
  | 'not-found' // 404: no such route
  | 'turnstile-failed' // 403: a missing, bad or unverifiable Turnstile token
  | 'too-large' // 413: the body is over its cap (`cap`, in bytes)
  | 'rate-limited' // 429: too many requests (`retryAfter`, in seconds, also as the Retry-After header)
  | 'feature-off' // 503: switched off (`feature`), by the maintainer or the watchdog
  | 'unavailable' // 503: the Worker is up but its storage is not

const STATUS: Record<ApiErrorCode, number> = {
  'not-found': 404,
  'turnstile-failed': 403,
  'too-large': 413,
  'rate-limited': 429,
  'feature-off': 503,
  unavailable: 503,
}

/** A refusal a guard or handler throws; `handleApi` turns it into its JSON response. */
export class ApiError extends Error {
  readonly code: ApiErrorCode
  readonly details: Record<string, string | number>

  constructor(code: ApiErrorCode, details: Record<string, string | number> = {}) {
    super(code)
    this.code = code
    this.details = details
  }

  /** The refusal as the API sends it: status from the code, details in the body, `Retry-After` when rate-limited. */
  toResponse(): Response {
    const response = json({ error: this.code, ...this.details }, STATUS[this.code])
    if (this.code === 'rate-limited') response.headers.set('Retry-After', String(this.details.retryAfter))
    return response
  }
}

/** A JSON response; the API is never cached and, sharing one origin with the app, has no CORS headers. */
export function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' },
  })
}
