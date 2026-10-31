/// <reference types="vite/client" />

/** package.json's version, set by vite.config.ts (the Menu's About section). */
declare const __APP_VERSION__: string

/** How many codes each Color catalog holds, by its id, counted by vite.config.ts from the files (the Homepage's free list). */
declare const __COLOR_CATALOG_CODES__: Readonly<Record<string, number>>
