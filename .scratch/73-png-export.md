# 73: PNG export

**What to build:** Add a PNG export option for a Pattern (a shareable raster image of the rendered chart), for posting to social media, forums, or craft groups.

**Blocked by:** 67 (Pattern renderer)

**Note (performance plan, ADR 0018):** the export draws with the Pattern renderer from 67, the same one the editor uses, so an exported bead looks like the on-screen one. It must work for the large Patterns the performance work allows (70×250 and 250×250): draw the whole Pattern in bounded pieces rather than assuming it fits one browser canvas.

**Status:** ready-for-agent

- [ ] A Pattern can be exported as a PNG image matching its on-screen rendering
- [ ] The exported image is legible at a reasonable default resolution for sharing/printing at typical sizes
