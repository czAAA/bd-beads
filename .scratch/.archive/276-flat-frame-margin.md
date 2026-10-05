# 276: Flat Frame margin: no band, a dashed outline while setting, a not-allowed cursor

**What to build:** The Frame's keep-out margin is drawn the way the v18 `Frame` card says: flat, with no fill, a gap in the grid dots where the margin lies, and a 1px dashed `line-strong` outline that fades in only while the Frame is being set, moved or resized and for 1s after a press in the margin is refused. The pointer shows `not-allowed` over the margin. Today `drawMarginBand` in `src/rendering/canvasRenderer.ts` still fills the margin with the dot colour at half strength (ticket 261's band), nothing draws a dashed outline, and `ProjectSurface.vue` only has crosshair, grab and grabbing. This reverses the "faint shaded band" in CONTEXT.md and ADR 0027, so update the glossary line and add a dated "Amended" note to ADR 0027 in the same change (no new ADR). Interactive because the feel of the fade and the refused press has to be seen. Source: the audit of design system v18 against the app (2026-10-04).

**Blocked by:** 273

**Human involvement:** interactive

**Status:** done

- [x] The margin has no fill and no dots drawn in it; the rest of the canvas is unchanged; theme and Canvas color variations all read well, including the dark and Ash backgrounds
- [x] A dashed `line-strong` outline of the margin fades in while a Frame is set, moved or resized (one drag, one fade), and after a refused press in the margin lasts 1s; reduced motion shows it without the fade
- [x] A refused press (Paint, Fill, Paste or Mirror landing in the margin) triggers that outline; Erase, which still works there, does not
- [x] The pointer is `not-allowed` over the margin for the tools that cannot place beads there; Erase and Hand keep theirs
- [x] Removing the Frame removes the margin and the outline; the `Frame` card, `interaction-and-motion.md` and `ProjectTheme` (DESIGN.md §4.2) agree with what is drawn
- [x] CONTEXT.md's Keep-out margin entry and ADR 0027 no longer say "band"; the README Version changelog has a line
- [x] Renderer tests and the canvas visual references regenerated deliberately
