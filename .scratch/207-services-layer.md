# 207: Move browser I/O into a services layer

**What to build:** Everything that talks to something outside the page's own memory lives under a new `src/services/`, as ADR 0020 decides. The app behaves exactly as today; only where the code lives, and how it is reached, changes.

**Blocked by:** None (can start immediately)

**Status:** done

- [x] `services/` holds a library store (today's `domain/patternStorage.ts`), file download/share (`domain/fileDownload.ts`), image decoding (`domain/imageDecode.ts`), and device-preference stores for the maker name (`loadMakerName`/`saveMakerName`), theme (`theme/theme.ts`, `useThemePick.ts`) and language (`i18n/localeStorage.ts`)
- [x] Each service is a small interface with a browser implementation; composables take it as a dependency with the browser one as default, so their tests pass a fake instead of stubbing `localStorage`
- [x] Pure parts stay where they are (`normalizeMakerName`, `MAX_MAKER_NAME`, `ImageConversionError`, `DecodeImage`'s pixel types if shared with `domain/`)
- [x] No file under `domain/` or `rendering/` imports a service or Vue, and nothing in `domain/` uses `window`, `navigator`, `localStorage`, `fetch` or `document`
- [x] No component imports from `services/`: `PatternList.vue` emits its two exports instead of calling `downloadFile`, and `NewPatternForm.vue`/`PatternImport.vue` get their decoder from props or the app-shell context
- [x] An ESLint `no-restricted-imports` (or similar) rule enforces the two lines above, if the repo's lint setup allows it
- [x] Typecheck and the full test suite pass
