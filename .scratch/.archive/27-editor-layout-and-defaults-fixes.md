# 27: Fix broken tool-strip/canvas layout; live-fit canvas zoom; default color and untouched-cell styling

**What to build:** A round of user-reported layout bugs in the ticket 21/ADR 0005 tool strip and the ticket 16-18 canvas box, plus three follow-on UX requests from the same session. Not a new feature area — a fix-and-polish pass over the existing editor shell and paint defaults.

**Bugs found and fixed:**
- The tool strip's cards (`flex: 0 0 auto`) couldn't shrink, so their own internal wrap rules (mirror buttons, palette swatches) never fired: on a narrow window the widest card spilled past the strip's dot-grid border instead of wrapping, and on a wide window most of the strip sat as bare, unused dot-grid texture next to a handful of small cards.
- The collapsed left main panel (`flex: 0 0 0` while a Pattern is open, ADR 0005) still left a dead 16px gutter from `.app-shell__body`'s `gap`.
- The below-canvas panel (`.app-shell__below-canvas`) had no layout CSS at all: its four sections (saved Patterns, bead quantities, transfer, catalog) ran together with no spacing or card framing, unlike every other region of the shell (ADR 0004).
- The canvas box was capped at a fixed `CANVAS_MAX_PX` pixel constant (480, later 640) with no relation to the browser's actual width, so on anything wider than that it sat small and centered in a large blank area with no visual explanation, occasionally accompanied by a needless internal scrollbar.

**Follow-on requests, same session:**
- Fit-to-screen zoom should reflect how much room the canvas area *actually* has on screen, not a guessed constant, and a typical Pattern should default to 100% zoom (one cell = one bead-sized square) rather than being zoomed out for no visible reason.
- The tool strip should be roughly a third of its previous height.
- A newly opened Pattern should have the red Palette color selected already, ready to paint without clicking a swatch first.
- An unpainted grid cell should render as a dimmed grey instead of plain white, distinguishable from a finished row's dimmed/grayscale look (ticket 13).

**How it was fixed:**
- Tool-strip cards changed from `flex: 0 0 auto` to `flex: 1 1 220px` (grow to fill the row, shrink before overflowing) and restructured from a stacked heading-then-controls block into a single inline row (label + controls side by side) — cutting the strip's height roughly threefold, per the tool-strip's own dot-grid card group model.
- `.app-shell__main--empty` switched from `flex: 0 0 0` to `display: none`, removing the dead gutter.
- `.app-shell__below-canvas` gained the same wrapping flex row + bordered-card treatment (ADR 0004) the rest of the shell already uses.
- `.app-shell__canvas` gained its own full-width bordered frame on the tool strip's dot-grid texture, so the canvas region reads as a panel in its own right; the Pattern's own box still sizes to the Pattern's shape and centers inside it rather than stretching (a bead grid is a fixed physical layout, not something that grows to fill space).
- New `useElementSize` composable (ResizeObserver-backed) measures the canvas area's real rendered size; `usePatternZoom` now fits against that live size instead of a fixed constant, re-fitting automatically on resize as long as the zoom hasn't been manually changed (a manual +/- zoom survives a resize until Reset or a Pattern switch). `PatternCanvas` no longer clamps its own box size to a constant — the fit already happened upstream, and CSS's `max-width: 100%` + `overflow: auto` remains only as the safety net for a manual zoom-in past the available space. `CANVAS_MAX_PX` (now 900) is kept only as the placeholder size assumed for the brief moment before the first real measurement lands.
- `selectedColorId` now defaults to `'red'` instead of `undefined`.
- Unpainted cells (`cell.color === null`) get `color-mix(in srgb, var(--color-ink) 25%, var(--color-paper-solid))` as their background instead of `--color-paper-solid`, kept apart from the Palette's own grey swatch (a real paint color) and from a finished row's opacity/grayscale dimming, which fades any cell — grey or not — well past this tint.

**Testing note:** verified via `vue-tsc` and the full `vitest` suite (316 tests passing), including new coverage for `useElementSize` (via a controllable fake `ResizeObserver`, `src/testUtils/fakeResizeObserver.ts`) and `usePatternZoom`'s live-resize/manual-zoom-persistence behavior. Not visually confirmed in a real browser — no screenshot tool was available in this session.

**Blocked by:** None (bug-fix/amendment to tickets 16, 18, 21 and ADR 0005)

**Status:** done

- [ ] Tool-strip cards fill the row's available width instead of leaving unused dot-grid space, and no longer overflow the strip's border on a narrow window
- [ ] Tool-strip cards render as a single compact line (label + controls inline) rather than a stacked heading-then-content block, cutting the strip's height roughly threefold
- [ ] The collapsed left main panel leaves no dead gutter while a Pattern is open
- [ ] The below-canvas panel's four sections each render in their own bordered card and share a row, matching the rest of the shell (ADR 0004)
- [ ] The canvas area renders as a full-width bordered card on the tool strip's dot-grid texture, with the Pattern's own box centered inside it rather than stretched
- [ ] The canvas box's fit-to-screen zoom is computed from the canvas area's real measured size (ResizeObserver), not a fixed pixel constant, so a typical Pattern opens at 100% instead of a needlessly reduced level
- [ ] A manually chosen zoom level survives a canvas-area resize until Reset or a different Pattern is opened; while at the fit level, a resize re-fits automatically
- [ ] A newly opened Pattern has the red Palette color selected by default, ready to paint without clicking a swatch first
- [ ] An unpainted grid cell renders as a dimmed grey, visually distinct from the Palette's own grey swatch and from a finished row's dimmed/grayscale treatment
