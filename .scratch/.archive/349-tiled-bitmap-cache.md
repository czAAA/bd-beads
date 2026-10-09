# 349: Tiled bitmap cache for the base layer

**What to build:** Keep drawn beads as bitmap tiles so a pan or pinch costs a handful of image copies, whatever the number of beads in view. While a gesture is under way, move and scale the tiles (or the whole layer with a transform); once it settles, redraw sharp. An edit redraws only the tiles it touched. Optionally move drawing into an OffscreenCanvas worker, so a slow redraw never blocks input.

**Why:** after 347, the cost of a redraw follows the beads in view. That is fine for a 150 × 30 piece, but ADR 0019 allows any size, and a very large piece at the Zoom floor (for example 500 × 500, a quarter of a million beads in view) would freeze again.

**Spec:** 347 (Position marks without the zoom-out freeze)

**Blocked by:** 347

**Status:** done

Open points to settle in triage:
- Tile size in beads, and a memory cap (tiles per zoom level, eviction)
- What invalidates tiles: edits, theme, Canvas color, Position marks style, rotation, Row progress, device pixel ratio
- How blurry a pinch may look before the sharp redraw, and how long after the gesture it comes
- Whether tiles hold Position marks too, or only beads over the pattern fill
- Whether to measure first: a large-piece benchmark that shows when this is worth building

## What was built

A smaller thing than tiles, settled in implementation:
- Past `GESTURE_BEAD_LIMIT` (20,000 beads to draw, an estimate from stored beads, Frame size and what fits in view), a pan or zoom no longer redraws. The beads canvas is moved and scaled with a CSS transform (`rendering/gestureView.ts`) and drawn sharp `SETTLE_MS` (120 ms) after the last step. Smaller pieces draw live exactly as before.
- Edits, theme, Position marks, Row progress, rotation, resize and pixel ratio changes still draw at once (they change the bitmap itself).
- Position marks are part of the bitmap that is moved.

Not built, left for a measured need: tiles, a memory cap, redrawing only the tiles an edit touched, an OffscreenCanvas worker. While a gesture is under way, a pan shows the Canvas color at the edge the bitmap no longer covers until it settles, and a zoom is blurry until then.
