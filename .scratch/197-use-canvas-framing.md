# 197: Extract canvas zoom/framing glue into useCanvasFraming

**What to build:** How the canvas is framed and zoomed (the sizing glue built on top of the existing `usePatternZoom`/`useElementSize` composables) works exactly as today, but lives in a new `useCanvasFraming` composable instead of inline in App.vue. Independent of the other extractions in ADR 0023.

**Blocked by:** None (can start immediately)

**Status:** ready-for-agent

- [ ] `useCanvasFraming` owns the zoom/framing glue currently inline in App.vue, calling the existing `usePatternZoom`/`useElementSize` composables (which do not change)
- [ ] App.vue no longer declares this glue directly
- [ ] Canvas framing and zoom percentage display behave exactly as before, across desktop and phone layouts
- [ ] App.vue still boots and all other existing tests pass
