/**
 * Build-time feature flags (ticket 44), read in exactly one place so every rich-mirror ticket (44-47) checks the
 * same switch and tests can set it either way (ADR 0006 amendment).
 *
 * Backed by Vite's env vars: `.env` ships `VITE_RICH_MIRROR=true`, which every build (including `npm run build`,
 * the GitHub Pages production build) picks up. On only when the value is exactly the string "true" -- missing or
 * any other value means off, so it stays a real switch (e.g. `VITE_RICH_MIRROR=false npm run build`) rather than
 * always-on code, in case it ever needs to be turned back off quickly.
 */
export function isRichMirrorEnabled(env: Pick<ImportMetaEnv, 'VITE_RICH_MIRROR'> = import.meta.env): boolean {
  return env.VITE_RICH_MIRROR === 'true'
}
