/** The API's refusals (spec 385, "API contract"): `{"error": "<code>", ...details}` with a stable code the app
 * translates; routes invent no codes of their own. Anything else a handler throws is a crash, left to the platform
 * (500, counted by the watchdog). */
type ApiErrorCode =
  | 'forbidden-origin' // 403: a changing request from another origin, or with none
  | 'turnstile-failed' // 403: a missing or rejected Turnstile token
  | 'not-found' // 404: no such route, or no such blob
  | 'length-required' // 411: an upload to R2 without Content-Length (R2 takes only a stream of known length)
  | 'too-large' // 413: the body is over its cap (`cap`, in bytes)
  | 'rate-limited' // 429: too many requests (`Retry-After`)
  | 'feature-off' // 503: switched off by the maintainer (`feature`, `Retry-After`)
  | 'storage-full' // 507: the blobs database is past BLOBS_STORAGE_LIMIT_MB

const STATUS: Record<ApiErrorCode, number> = {
  'forbidden-origin': 403,
  'turnstile-failed': 403,
  'not-found': 404,
  'length-required': 411,
  'too-large': 413,
  'rate-limited': 429,
  'feature-off': 503,
  'storage-full': 507,
}

/** A refusal a guard or handler throws; `handleApi` turns it into its JSON response. */
export class ApiError extends Error {
  readonly code: ApiErrorCode
  readonly details: Record<string, string | number>
  /** Seconds, sent as the `Retry-After` header; the app waits at least this long before trying again. */
  readonly retryAfter?: number

  constructor(code: ApiErrorCode, details: Record<string, string | number> = {}, retryAfter?: number) {
    super(code)
    this.code = code
    this.details = details
    this.retryAfter = retryAfter
  }

  /** The refusal as the API sends it: the status from the code, the details in the body. */
  toResponse(): Response {
    const response = json({ error: this.code, ...this.details }, STATUS[this.code])
    if (this.retryAfter !== undefined) response.headers.set('Retry-After', String(this.retryAfter))
    return response
  }
}

/** A JSON response. The API is never cached and, sharing one origin with the app, sends no CORS headers. */
export function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' },
  })
}
