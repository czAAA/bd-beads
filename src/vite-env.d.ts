/// <reference types="vite/client" />

/** The Build's Version, "1.0.0", set by vite.config.ts from the release record and the Release notes (ticket 1045). */
declare const __APP_VERSION__: string

/** The Build's build mark, the commit's hash in seven characters (`dev` outside git), set by vite.config.ts. */
declare const __BUILD_MARK__: string

/** The day of the Build's newest Release note or Production release, `YYYY-MM-DD`, set by vite.config.ts. */
declare const __BUILD_DATE__: string

/** How many codes each Color catalog holds, by its id, counted by vite.config.ts from the files (the Homepage's free list). */
declare const __COLOR_CATALOG_CODES__: Readonly<Record<string, number>>

interface Window {
  /** The browser's cross-fade from the Homepage into the editor, kept by index.html's arrival script (ticket 0776). */
  openbeadsHandoff?: ViewTransition | null
}
