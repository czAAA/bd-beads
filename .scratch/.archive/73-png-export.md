# 73: PNG export

**What to build:** Add a PNG export option for a Pattern (a shareable raster image of the rendered chart), for posting to social media, forums, or craft groups.

**Blocked by:** 67 (Pattern renderer)

**Note (performance plan, ADR 0018):** the export draws with the Pattern renderer from 67, the same one the editor uses, so an exported bead looks like the on-screen one. It must work for the large Patterns the performance work allows (70×250 and 250×250): draw the whole Pattern in bounded pieces rather than assuming it fits one browser canvas.

**Status:** done

- [x] A Pattern can be exported as a PNG image matching its on-screen rendering
- [x] The exported image is legible at a reasonable default resolution for sharing/printing at typical sizes

**Done:** Toolbox → Edit group has an "Export as PNG image" button. `src/rendering/patternExport.ts` draws the Pattern with the Pattern renderer (as displayed, turned if turned, Row progress fading left out so every bead is at full color) at 30 px a bead, a strip of rows at a time into `src/domain/pngEncoder.ts` (a streaming PNG writer over `CompressionStream`), so a 250×250 Pattern never needs one big canvas; a Pattern too big for 30 px a bead is drawn smaller to stay inside 16 megapixels. Checked in a real browser by `e2e/visual/export.spec.ts` (bead colors at their positions, 250×250 within budget).
