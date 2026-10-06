# 319: One Surface view for bead ↔ screen

**What to build:** Converting between beads and screen points is one concept cut into thin slices: `rendering/canvasView.ts` (forward: box, centre, zoom about an anchor, fit), `rendering/hitTest.ts` (inverse, with the rotation switch written three times), the row helpers in `rendering/projectRenderer.ts` (`rowPitchPx`, `rowTopPx`, `rowShiftPx`, `projectExtentPx`, `displayedExtentPx`) and the transform helpers 318 moves beside them, the geometry half of `rendering/frameHandles.ts` (`frameLineBox`, `framePressAt`), `computeFitZoom` in `domain/grid.ts`, and Convert image's own screen-to-mm ratio (`mmPerScreenPx` in `ConvertImageFrame.vue`). Pull them into one module, `rendering/surfaceView.ts`:

- **Interface.** `surfaceView({ space, technique, rotation, zoom, scroll, viewport })`, where `space` is 318's shared `Space`, returns an object answering both directions: `beadToPoint`, `beadBox`, `pointToBead`, `pointToCell`, `frameBox`, `scrollToCentre(box)`, `scrollAfterZoom(anchor, to)`, `zoomToFit(box, margin)` and `beadStep()` (how far one column step and one row step are on screen). Rotation, the row shift and the row pitch (with brick stitch's seam pixel) are private to it. `CELL_SIZE_PX` moves here from `domain/grid.ts`.
- **Callers.** `ProjectSurface` builds one in a `computed` and hands the same value to the renderer and the overlay. `useCanvasView` uses it for centring, zoom and fit. `rulers.ts` and `rulerRenderer.ts` swap their `displayedBox` / `gridToDisplayed` / `frameLineBox` calls for it, and nothing more (reshaping the Ruler layout is candidate A2). `frameHandles.ts` keeps only handle layout and touch slack.
- **Convert image.** `ConvertImageFrame` builds a Surface view over the Frame-only space of its lattice (rotation 0, zoom = its fit scale, no scroll). The fit scale comes from `zoomToFit`; `computeFitZoom` is deleted. The drag ratio is the Bead's mm footprint divided by `beadStep()`; the Surface view never knows about mm.
- **Delete** `canvasView.ts`, `hitTest.ts`, and the Frame-only `beadAt`, which has no caller outside its tests (unless knip in 311 removed it first).

**Physical geometry vs drawn geometry (amends ADR 0010).** Two row geometries exist on purpose. Physical geometry, in `domain/grid.ts`, is the real piece in mm: brick rows sit one bead apart with no gap, and Convert image samples and frames the picture with it. Drawn geometry, in the Surface view, adds brick stitch's 1px seam between rows, which is a drawing choice only. Make that impossible to mix up: `grid.ts` drops its px defaults and the `Px` names (`rowOffsetPx` → `rowOffset(technique, row, beadWidth)`, `rowHeightPx` → `rowPitch(technique, beadHeight)`, `gridWidthPx` / `gridHeightPx` → `gridWidth` / `gridHeight`; `cellCenter` keeps its name). `MIN_ZOOM`, `stepZoom` and `clampZoom` stay in `domain/`. Add an amendment note to ADR 0010 stating the rule, a comment at both places, and a "Surface view" entry in CONTEXT.md plus one sentence that the seam exists only in the drawing.

**Tests.** The `data-*` attributes on the surface stay (the e2e helpers read `data-scroll-x` / `data-scroll-y` for pointer positions), but `beadPoint` in `testUtils/beads.ts` calls `beadToPoint` instead of re-doing the geometry. The `canvasView` and `hitTest` tests move into one table over Technique × rotation × space (open, Frame-only) × a couple of zoom/scroll values, rather than being kept beside it.

No visible change: the refactor is pixel-neutral (308 has already fixed the brick drag drift; this routes its ratio through the Surface view). Candidate A3 of the architecture review of 2026-10-05.

**Blocked by:** 318 (shared `Space`, transform helpers moved), 308 (brick drag ratio).

**Status:** done

- [x] `rendering/surfaceView.ts` answers bead → point/box and point → bead/cell behind one interface built from a `Space`; rotation, row shift and row pitch are private to it
- [x] `canvasView.ts`, `hitTest.ts`, the Frame-only `beadAt` and `computeFitZoom` are gone; `frameHandles.ts` keeps only handle layout
- [x] `ProjectSurface`, `useCanvasView`, the renderer, the overlay, the rulers and `ConvertImageFrame` take their geometry from the Surface view
- [x] Convert image's fit scale comes from `zoomToFit` and its drag ratio from the Bead's mm footprint over `beadStep()`
- [x] `domain/grid.ts` has no px defaults or `Px` names; `CELL_SIZE_PX` lives in the Surface view module
- [x] A round-trip table test over Technique × rotation × space × zoom/scroll checks `pointToBead(beadToPoint(b)) == b`, and that points on a brick seam or in a half-bead gap give no bead; it replaces the `canvasView` and `hitTest` tests
- [x] `beadPoint` in `testUtils/beads.ts` uses `beadToPoint`; the surface's `data-*` attributes stay for e2e
- [x] ADR 0010 has an amendment note on physical vs drawn geometry; CONTEXT.md has a "Surface view" entry and the seam sentence
- [x] The visual check passes with no screenshot changes
- [x] Typecheck, lint, unit tests and the visual check pass in CI
