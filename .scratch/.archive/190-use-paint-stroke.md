# 190: Extract paint-stroke lifecycle into usePaintStroke

**What to build:** Drag-painting on the grid (starting a stroke, painting cells as the pointer moves, ending the stroke and committing it as one undo step) works exactly as today, but lives in a new `usePaintStroke` composable that commits through `useUndoHistory` (#189) rather than inline in App.vue. Part of the App.vue decomposition in ADR 0023.

**Blocked by:** 189 (useUndoHistory)

**Status:** done

- [ ] `usePaintStroke` owns stroke state and `beginStroke`/`endStroke`/`paintStrokeCell`/`beginOrCommitPress`, committing via `useUndoHistory`
- [ ] App.vue no longer declares any of the above directly
- [ ] A single paint stroke (mouse down, drag, mouse up) still produces exactly one undo step, same as today
- [ ] App.vue still boots and all other existing tests pass

## Resolution

**What changed:** The stroke lifecycle (`strokeMode`, `beginStroke`, `endStroke`, `paintStrokeCell`, `beginOrCommitPress`) moved from App.vue into the new `usePaintStroke` composable. App.vue destructures `strokeMode`, `endStroke`, `paintStrokeCell`, `beginOrCommitPress` and no longer declares them. A drag is still one undo step (recorded via `useUndoHistory`) and one save.

**Files:** `src/composables/usePaintStroke.ts` (new), `src/composables/usePaintStroke.test.ts` (new), `src/App.vue`, plus `docs/agents/pull-requests.md` and `CLAUDE.md` for the PR headline format.

**Decisions:** Deps are lazy accessors, like `useUndoHistory`. `endSelectPress` and `flushPendingSave` are passed in, because `endStroke` also ends a Select press and writes the deferred save.

**Left out:** `beginStroke` is returned but only used internally.
