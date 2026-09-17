/**
 * Build-time feature flags (ticket 44), read in exactly one place so every rich-mirror ticket (44-47) checks the
 * same switch and tests can set it either way (ADR 0006 amendment).
 *
 * Backed by Vite's env vars: `.env` ships `VITE_RICH_MIRROR=false` (what `npm run build` uses -- the GitHub Pages
 * production build); `.env.development` ships it `=true` (what `npm run dev` uses). On only when the value is
 * exactly the string "true" -- missing or any other value means off, so production stays safe by default even if an
 * env file goes missing or gets mistyped.
 */
export function isRichMirrorEnabled(env: Pick<ImportMetaEnv, 'VITE_RICH_MIRROR'> = import.meta.env): boolean {
  return env.VITE_RICH_MIRROR === 'true'
}
