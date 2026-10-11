import type { Env } from './env'

/**
 * The features the maintainer can switch off by hand (spec 385, "Kill switches"). `api` is everything under /api
 * except health. A later ticket that adds a feature registers its name here and in `docs/operations.md`.
 */
export const FEATURES = ['api', 'view-links', 'sign-up', 'sign-in', 'sync', 'magic-link'] as const
export type FeatureName = (typeof FEATURES)[number]

/**
 * How long the app waits before trying a switched-off feature again. A switch is lifted by hand once its cause is
 * gone, so there is no real end time; a quarter of an hour keeps retries rare without leaving a lifted feature dark.
 */
export const FEATURE_OFF_RETRY_SECONDS = 900

/**
 * The features listed in the `DISABLED_FEATURES` variable, the only kill switch: set in the dashboard, kept across
 * deploys by `keep_vars`, never declared in `wrangler.jsonc`. Nothing switches a feature off automatically.
 */
export function disabledFeatures(env: Env): Set<string> {
  return new Set((env.DISABLED_FEATURES ?? '').split(',').map((name) => name.trim()).filter(Boolean))
}
