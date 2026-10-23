/** What the Worker is given (spec 385): bindings and variables in `wrangler.jsonc`, dashboard variables, and
 * secrets. A variable may arrive as a number or, once edited in the dashboard, a string, so limits and levels go
 * through `numberVar`. */
export interface Env {
  /** Accounts, plan status, settings (ADR 0049); empty until ticket 78's first migration. */
  CORE: D1Database
  /** View links' and Free accounts' ciphertext, with owner, size and expiry (ADR 0049). */
  BLOBS_DB: D1Database
  /** Pro's synced Projects only (spec 385), so the one storage that bills grows only with paying customers. */
  BLOBS: R2Bucket
  /** The built app and Overview; the platform serves them itself and calls the Worker only for /api/*. */
  ASSETS: Fetcher

  /** Which Worker this is, so every health answer and alert names it. */
  WORKER_NAME: 'dev' | 'production'
  /** The origin people use this Worker on (ticket 400). Google's callback and the allowed origins come from this,
   * never the request's host: `workers.dev` stays on until the release, and Google lists no such redirect URI. */
  PUBLIC_ORIGIN?: string
  /** The git commit of the deploy, passed by the deploy workflow with `--var VERSION:<sha>`. */
  VERSION?: string
  /** Set by hand in the dashboard, never in `wrangler.jsonc`: comma-separated features switched off (worker/src/features.ts). */
  DISABLED_FEATURES?: string

  /** The account and this Worker's own script name, databases and bucket, for watchdog/analytics.ts (the runtime
   * can't tell). */
  CF_ACCOUNT_ID?: string
  WORKER_SCRIPT?: string
  CORE_DATABASE_ID?: string
  BLOBS_DATABASE_ID?: string
  BLOBS_BUCKET_NAME?: string

  /** Public ids, not secrets: the Google OAuth client (ticket 78) and the Turnstile site key. One of each serves
   * both Workers and localhost. */
  GOOGLE_CLIENT_ID?: string
  TURNSTILE_SITE_KEY?: string

  UPLOAD_CAP_D1_BYTES: number | string
  UPLOAD_CAP_R2_MB: number | string
  BLOBS_STORAGE_LIMIT_MB: number | string

  WARN_API_REQUESTS: number | string
  WARN_D1_ROWS_WRITTEN: number | string
  WARN_BLOBS_DB_MB: number | string
  WARN_CORE_DB_MB: number | string
  WARN_R2_STORAGE_MB: number | string
  WARN_WORKER_ERRORS: number | string

  /** Secret: Turnstile's secret key (Cloudflare's dummy keys in tests). */
  TURNSTILE_SECRET_KEY?: string
  /** Secret: a read-only Account Analytics token, for the watchdog. */
  CF_ANALYTICS_TOKEN?: string
  /** Secret: this Worker's Healthchecks.io ping URL (`watchdog-dev` or `watchdog-production`). */
  HEALTHCHECK_URL?: string
}

/** The variables that hold a number: every limit and warn level. */
export type NumberVar =
  | 'UPLOAD_CAP_D1_BYTES'
  | 'UPLOAD_CAP_R2_MB'
  | 'BLOBS_STORAGE_LIMIT_MB'
  | 'WARN_API_REQUESTS'
  | 'WARN_D1_ROWS_WRITTEN'
  | 'WARN_BLOBS_DB_MB'
  | 'WARN_CORE_DB_MB'
  | 'WARN_R2_STORAGE_MB'
  | 'WARN_WORKER_ERRORS'

/** A numeric variable's value; NaN when it is missing or not a number, which every caller treats as misconfigured. */
export function numberVar(env: Env, name: NumberVar): number {
  const value = env[name]
  return typeof value === 'number' ? value : value.trim() === '' ? Number.NaN : Number(value)
}

/** Bytes in one MB, as every `_MB` variable counts them. */
export const MB = 1024 * 1024
