# 365: Mirror is switched off by a flag in `features.ts`

**What to build:** Ticket 174 hid Mirror's controls by hand in `Toolbox.vue`. Every switched-off feature is a flag in `src/features.ts` (ADR 0041), so Mirror gets `MIRROR_ENABLED = false` and every place that hides it reads the flag. Nothing visible changes.

**Blocked by:** None (can start immediately)

**Status:** done

- [x] `MIRROR_ENABLED = false` in `src/features.ts`, with a comment naming ticket 174 and the redo
- [x] Every hand-written hiding of Mirror (Toolbox, phone sheets, ContextBar, live mirroring while drawing, shortcuts) reads the flag instead
- [x] Mirror's tests run with the flag on, as the Tour's do
- [x] ADR 0006 and ADR 0041 drop "Code catches up in ticket 365"
- [x] The ticket is archived in the same change
