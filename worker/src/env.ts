/** What the Worker is given by Wrangler's config (`wrangler.jsonc`), the dashboard variables and the secrets. */
export interface Env {
  /** The environment's D1 database: switches, counters, rate limits, small blobs. */
  DB: D1Database
  /** The environment's R2 bucket: Pro's synced Projects only (spec 385). */
  BLOBS: R2Bucket
  /** The built app and Overview; the Worker is only invoked for /api/* (`run_worker_first`). */
  ASSETS: Fetcher
  /** Which Worker this is, so every health answer and alert names it. */
  WORKER_NAME: 'dev' | 'production'
  /** The git commit the deploy came from, passed by the workflow with `--var`. */
  VERSION?: string
  /** Comma-separated feature names the maintainer switched off in the dashboard. */
  DISABLED_FEATURES?: string
  /** Seconds a Worker isolate keeps the D1 switches before reading them again (default 60). */
  SWITCHES_CACHE_SECONDS?: string

  /** Secret: Turnstile's secret key (Cloudflare's dummy keys in tests). */
  TURNSTILE_SECRET_KEY?: string

  /** Where the watchdog reads today's usage: Cloudflare's analytics or its own D1 counters (default 'd1'). */
  USAGE_SOURCE?: 'd1' | 'graphql'
  /** Multiplies every watchdog level, to try the alerts on dev with small numbers (default 1). */
  WATCHDOG_LEVEL_FACTOR?: string
  /** GraphQL reader only: the account, a read-only Account Analytics token (secret) and production's database id. */
  CF_ACCOUNT_ID?: string
  CF_ANALYTICS_TOKEN?: string
  D1_DATABASE_ID?: string

  /** Secrets: the Telegram bot the watchdog writes to. */
  TELEGRAM_BOT_TOKEN?: string
  TELEGRAM_CHAT_ID?: string
  /** Secret: this Worker's Healthchecks.io ping URL, pinged after every watchdog run. */
  HEALTHCHECK_URL?: string
}
