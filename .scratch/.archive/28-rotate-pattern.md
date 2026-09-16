# 28: Rotate a Pattern's view between horizontal and vertical orientation

**What to build:** A "Rotate" icon button in the tool strip (next to Undo) that flips how the open Pattern is displayed 90°, like turning a photo — a purely visual toggle, not an edit. Clicking it turns the whole rendered picture (grid, offset stagger, rulers, everything) 90°; clicking again turns it back. The underlying grid data, `columns`/`rows`, `widthMm`/`heightMm`, and technique never change — only the on-screen presentation does.

**Revision (2026-09-16):** The first implementation of this ticket actually transposed the grid data (swapping `columns`/`rows` and re-running each Technique's offset geometry on the rotated data). The user tested it and rejected it: for Peyote/Brick, the offset stagger is computed row-wise from scratch on the rotated data, so a straight diagonal line turned into a jagged, visibly different shape after rotating — "the weaving pattern changes," not just the orientation. The user's ask, restated plainly: rotate like a photo/graphics-editor orientation toggle — nothing about the picture itself should change, ever, for any Technique. Rebuilt as a view-only flag (`Pattern.rotated: boolean`) with the actual 90° turn applied as a CSS transform on the rendered canvas box (grid + rulers together), so the exact same rendered picture turns as a whole with no re-derived geometry involved. See [[feedback_rotate_offset_techniques]] (memory) for the corrected rule.

**Blocked by:** None

**Status:** done

- [ ] A Rotate icon button (two overlapping rectangles — portrait over landscape — not an arrow, to avoid reading as "undo/refresh") sits in the tool strip's Undo card and toggles the active Pattern's `rotated` flag on click
- [ ] Rotating is purely a view flag: grid, `columns`/`rows`, `widthMm`/`heightMm`, and technique are provably untouched (same object references) before and after toggling
- [ ] The rendered canvas box (grid + all four ruler gutters) turns 90° as one rotated CSS box, centered so its bounding footprint exactly matches the swapped width/height — the offset stagger for Peyote/Brick turns with the picture instead of being recomputed on the rotated data, so what was a straight diagonal stays a straight diagonal
- [ ] Painting/clicking cells works correctly through the rotated view (verified with real coordinate-based clicks, not just synthetic events) — the DOM element under the cursor, and therefore which logical grid cell gets painted, is unaffected by the CSS transform
- [ ] Rotating is not an undo step (it isn't a grid edit) and doesn't touch the undo stack
- [ ] The canvas zoom refits to the swapped footprint immediately after toggling
- [ ] The header's Pattern summary (`name · WxH`) reflects the current rotated view's swapped dimensions, even though the stored `columns`/`rows` didn't change
- [ ] Works the same way for every Technique (Loom, Peyote, Brick stitch) — no technique-specific rotation behavior, and no technique ever looks visually different after a round trip (rotate, then rotate back)
