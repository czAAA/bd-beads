# 108: Renderer becomes the default, and the cap goes

**What to build:** The Pattern renderer is what the app uses to draw and edit a Pattern, and the 10,000-cell cap is gone. From here a Pattern such as 70×250 (a bracelet-sized target, 17,500 cells) or 250×250 (62,500 cells) can be created, edited and opened, and its performance can be tested for real. The DOM grid and the temporary switch still exist (removed in 111) so the remaining tests can be migrated, but they are no longer what runs.

The cap comes out everywhere ADR 0017 put it: the New Pattern form, Convert image and Resize, including the refusal messages that speak of it. What limits a Pattern instead (browser storage space, memory) is not designed here: the point is to test big sizes and then decide, from what is measured, whether any cap is wanted at all or whether large projects should simply be allowed. A new ADR supersedes the cap paragraph of ADR 0017 and records that decision as it stands after testing.

**Blocked by:** 104 (Convert image framing on the renderer), 107 (Overlay layer on the renderer)

**Status:** done

- [x] The renderer path is the default for opening and editing a Pattern; the DOM grid is used only where the temporary switch is turned on
- [x] No cell cap applies when creating a Pattern (any unit), converting an image, or growing one with Resize; the refusal messages and their translations for it are removed
- [x] A 70×250 and a 250×250 Pattern can be created, edited, saved, reloaded, exported as a Pattern file and undone
- [~] Targets are measured with ticket 103's performance check and recorded in this ticket: at 4× CPU slowdown at least 30 fps for hover and paint at 70×250 and 250×250, opening in about 200 ms at 70×250; and a manual pass on the iPad Air 13″ for 60 fps at 250×250
- [x] Storage behaviour with very large Patterns is checked: a full-storage save still shows the existing "couldn't save" message and keeps the edit on screen (ADR 0012)
- [x] A new ADR supersedes the cap paragraph of ADR 0017, and CONTEXT.md and ADR 0017's own header are updated to say so
- [x] Existing Patterns still open unchanged (ticket 103's compatibility test passes)

## How it came out

- **Default.** The switch inverts (`src/devSwitches.ts`): the renderer draws the Pattern unless the address says `?renderer=dom`, which brings the DOM grid back. Both stay until ticket 111 deletes them. Because the tests that find beads as DOM elements are tickets 109 and 110's to move, `testSetup.ts` starts every unit test on `?renderer=dom`; tests of the default and of the surface say so themselves (`PatternCanvas.test.ts`). The browser checks that hold the DOM to its own references (`visual.spec.ts`, the stand-in in `renderer.spec.ts`) ask for the DOM grid explicitly; the rest run on the default. `GRID=dom npm run perf` measures the DOM grid.
- **The cap is gone** from the New Pattern form (every unit, and so Convert image's Create and file input), Resize (the `over-cap` refusal and the message that stayed on screen) and the App's framing draft, with `MAX_PATTERN_CELLS`, `isOverCellCap`, `sizeCapRefusal`, their types and the `sizeCap` translations (EN and RU). What still refuses a size is what always did: not whole beads, not at least 1, an odd change of rows in pairs from the start, Row progress on. Tests replaced, not dropped: every cap test became its opposite (10,001 cells, 500 × 10, 200 × 200, 70 × 250 and 250 × 250 accepted in beads, mm and cm for every Bead and Technique; Resize grows past 10,000 in the domain, the controls and the App, and undoes; a Pattern past the old limit opens and grows or shrinks; Convert image is on for a big size); the tests of the refusal's wording, its Bead and unit naming and the suggested maximum went with the message and stood in for nothing else.
- **A 70 × 250 and a 250 × 250 Pattern** are created through the form, painted (a click, and a dragged stroke that is one Undo step and can be redone), saved, reloaded, exported as a Pattern file (downloaded and read back with the app's own parser: size and painted bead intact), and undone, in a real browser on the renderer (`e2e/visual/large-patterns.spec.ts`, in CI); Convert image frames and creates a 250 × 250 Pattern from a picture. Undo history is per session, so undo is checked in the session that painted.
- **Storage.** A full device (`setItem` throwing `QuotaExceededError`) at 70 × 250 and at 250 × 250 shows the top bar's "couldn't save" notice and keeps the painted bead on screen (the bead's centre is checked in a screenshot). Measured stored sizes for the ADR: 250 × 250 is 0.4 KB empty, 31 KB in blocks of color, 136 KB as random noise in twelve colors (worst case); 70 × 250 is 0.3 / 9 / 38 KB.
- **ADR 0019** ("A Pattern has no size limit: the device is the limit") supersedes the cap paragraph of ADR 0017; ADR 0017's header and its cap bullet, ADR 0018's last consequence, and CONTEXT.md's Pattern size entry now say so. Existing Patterns open unchanged: ticket 103's compatibility test passes (its over-cap fixture now names the old cap as `FORMER_CELL_CAP`).

### Not done: the manual pass on an iPad Air 13″
The last targets line asks for a manual pass on an iPad Air 13″ for 60 fps at 250 × 250. There is no such device here, so it has not been made. Everything below is measured on the production build in a headless Chromium with the CPU slowed, which stands in for a slow device and says nothing about an iPad's GPU or Safari. It needs a person with the device: open a 250 × 250 Pattern, paint, hover, scroll, pinch-zoom and check the framing step.

### Performance (`npm run perf`, the default: the renderer; DOM baseline from ticket 103 in brackets)

| At 4× slowdown | 60×90 | 70×250 | 250×250 |
| --- | --- | --- | --- |
| open | 116 ms (349) | **142 ms** (946) | 255 ms (3,079) |
| hover | 60 fps (11) | **60 fps** (3) | **60 fps** (1) |
| paint stroke | 60 fps (23) | **60 fps** (7) | **60 fps** (2) |
| Selection drag / paste hover | 60 / 60 fps | **60 / 60 fps** | **60 / 60 fps** |
| scroll | 54 fps (21) | **54 fps** (7) | 29 fps (2) |
| zoom step | 116 ms (163) | 121 ms (458) | 177 ms (1,497) |
| framing drag, loom | 43 fps (18) | 32 fps (not possible) | 9 fps (not possible) |
| framing drag, brick stitch | 43 fps | 30 fps | 7 fps |
| framing drag, peyote | 22 fps | 17 fps | 6 fps |

At 6×: open 158 / 184 / 351 ms; hover, paint, Selection drag and paste hover 60 fps at every size (7–11 ms); scroll 49 / 48 / 60 fps; zoom step 140 / 161 / 250 ms.

The targets: hover and paint hold at least 30 fps at 70×250 and 250×250 at 4× (60 fps); opening at 70×250 is 142 ms (about 200 asked for). Two numbers are still under the floor, noted rather than hidden: **scrolling a 250×250 Pattern is 29 fps at 4×** (60 at 6×; the whole Pattern is in the window at its fit zoom, so nothing is redrawn while scrolling and the cost is the page's own layout and compositing, which does not grow with the Pattern), and **Convert image's framing drag at 250×250 (6–9 fps) and in peyote (17–22 fps above 60×90)**, where the frame alone is 62,500 beads redrawn per move; ticket 104 asked 60×90 and 100×100, which loom and brick stitch hold. The New Pattern form's slow-framing hint (from 12,000 cells) already warns of this.
