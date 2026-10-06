# 310: One device-preferences module instead of a store and a composable per preference

**What to build:** Each on-device preference is its own store in `src/services/` plus, for the newer ones, its own composable, and each is the same `try { localStorage.getItem } catch { default }`, validate, `ref`, save-on-change: `rulersStore.ts` (33 lines) with `composables/canvas/useRulers.ts` (14), `progressBarStore.ts` (33) with `useProgressBarToggle.ts` (14), `zoomPillStore.ts` (36) with `useZoomPillCorner.ts` (15), `canvasBackgroundStore.ts` (36, not even in `Services`), `themeStore.ts` (37) and `localeStore.ts` (22). Adding one preference touched 13 to 15 files (tickets 296, 297). `useThemePick` and `useCanvasBackground` are also module singletons that bypass `Services` (whichever store the first caller passes wins). Replace them with one device-preferences module in `services/`: each preference is declared once (storage key, default, validation such as `isZoomPillCorner`) and is read as a reactive value that saves itself, with blocked or full storage handled once. It is reached through `Services` like the rest, so composables and `theme/`/`i18n/` never touch `localStorage` (ADR 0020). Storage keys and stored values stay exactly as they are, so every saved preference survives the change. `makerNameStore`, `addedColorsStore`, `tourStore` and `libraryStore` join only if they fit without special cases; otherwise they stay as they are. Candidate G1 of the architecture review of 2026-10-05.

**Blocked by:** None (can start immediately).

**Status:** done

- [ ] One module in `services/` declares the Rulers, Progress bar toggle, Zoom pill corner, Canvas color, theme and language preferences, and is part of `Services`
- [ ] The per-preference stores and the three 14-line composables are deleted; their callers read the preference from the new module
- [ ] `useThemePick` and `useCanvasBackground` no longer hold a module-level store; they get it through `Services`
- [ ] Existing storage keys and value formats are unchanged; a test seeds each old key and reads it back through the new module
- [ ] One test suite covers the shared behaviour (default when missing, default when invalid, default and no crash when storage throws, saves on change) and replaces the per-store test files
- [ ] Adding a preference is one declaration plus its callers (say so in the module's doc comment)
