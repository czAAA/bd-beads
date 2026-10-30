import type { Env } from './env'

/** The features the maintainer can switch off by hand (spec 385, "Kill switches"); `api` is all of /api except health.
 * A feature ticket registers its name here and in `docs/operations.md`. */
export const FEATURES = ['api', 'view-links', 'sign-up', 'sign-in', 'sync', 'magic-link', 'feedback'] as const
export type FeatureName = (typeof FEATURES)[number]

/** How long the app waits before retrying a switched-off feature: a switch is lifted by hand, so there is no end
 * time. */
export const FEATURE_OFF_RETRY_SECONDS = 900

/** The features in the `DISABLED_FEATURES` variable, the only kill switch: set in the dashboard, kept by `keep_vars`,
 * never in `wrangler.jsonc`. Nothing switches a feature off automatically. */
export function disabledFeatures(env: Env): Set<string> {
  return new Set((env.DISABLED_FEATURES ?? '').split(',').map((name) => name.trim()).filter(Boolean))
}
