# 57: Zoom controls pin to the canvas panel's corner, not the Pattern's own box

**What to build:** Ticket 51 fixed the zoom cluster to "the canvas box's top-right corner," but that phrase was read as the Pattern's own bordered box (`PatternCanvas.vue` / `.pattern-canvas`, the notepad page sized to the open Pattern per ticket 18) rather than the surrounding **canvas** panel (`App.vue`'s `.app-shell__canvas`, `data-testid="app-canvas"`, the padded dot-grid frame that panel occupies per ADR 0004). Corrected on review: the zoom cluster moves to the canvas *panel's* top-right corner, fixed there regardless of the Pattern's own box size, position, zoom or scroll offset within it.

- Zoom controls become a sibling of the Pattern's own box inside `.app-shell__canvas`, not a child of `.pattern-canvas` — same compact horizontal cluster (+, level, −, reset) and translucent background from ticket 51, just anchored one level up.
- The canvas panel's horizontal scrolling (a manual zoom-in wider than the panel, ticket 28) moves only the Pattern's own box underneath; the zoom cluster stays put in the panel's corner throughout.
- The Pattern's own box keeps its ticket 18 shape: snug fit to the open Pattern, border visible on all four sides, no zoom chrome of its own anymore.

**Blocked by:** None (can start immediately)

**Status:** ready-for-agent

**Decisions (2026-09-18):**
- This corrects ticket 51's own implementation, not a new redesign — ticket 51 stays archived as-is; this ticket's job is making the shipped behavior match what "canvas box" was meant to reference for zoom's parent, using the panel/box distinction ADR 0004 already draws (main/above-canvas/canvas/below-canvas panels, with the Pattern's own sized box living inside the canvas panel).
- `PatternCanvas.vue` no longer renders `ZoomControls` itself or forwards `zoom-in`/`zoom-out`/`zoom-reset`; `App.vue` renders `ZoomControls` directly next to `PatternCanvas` and wires it straight to `usePatternZoom`.
- ADR 0004 and ADR 0005 get amendment notes correcting the ticket-51 wording for future readers.

- [ ] Zoom cluster renders fixed to `.app-shell__canvas`'s top-right corner (compact horizontal +, level, −, reset, translucent background), only while a Pattern is open
- [ ] Zoom cluster stays in that same corner of the canvas panel regardless of the Pattern box's own size, and while the panel is scrolled, zoomed or rotated
- [ ] The Pattern's own box (`.pattern-canvas`) no longer positions or renders the zoom cluster itself
- [ ] Clicking, dragging or hovering over the zoom cluster still never paints, erases, selects or shows a hover preview on the cells beneath it
- [ ] The Pattern's own box still fits the Pattern snugly and shows its border on all four sides at every zoom level
- [ ] Tooltips and aria-labels on the zoom buttons are unchanged in both languages
- [ ] ADR 0004 and ADR 0005 amendment notes correcting ticket 51's "canvas box" wording are present
