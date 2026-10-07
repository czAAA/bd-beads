# 328: Note: always-visible helper text replaces the (i) popups

**What to build:** A `Note` component: a thin block of helper text on a gray surface, with `meta` type and `muted` text and no icon, always visible (see the Note entry in CONTEXT.md). Use it for the size estimate in the Frame section (`FrameControls.vue`, `size-estimate-info`) and the Bead quantities explanation (`BeadQuantities.vue`, `quantities-weight-info`), carrying over their current popup text. Delete the hand-built (i) popup code, its styles and its tests. Add a Note card to the design system (README, tokens, `bundle.css`, `design-values.css`, changelog).

**Spec:** 343 (unified controls spec)

**Blocked by:** None (can start immediately).

**Status:** done

- [x] `Note` renders its text in a gray, borderless block using only role tokens
- [x] The size estimate and Bead quantities show their text as a Note, with no (i) button
- [x] The custom popup code is removed (knip clean)
- [x] The design system has a Note card
