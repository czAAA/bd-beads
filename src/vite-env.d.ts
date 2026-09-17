/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Rich Mirror (ticket 44): see src/featureFlags.ts. On only when exactly "true"; `.env`/`.env.development` set it. */
  readonly VITE_RICH_MIRROR?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
