# 67: Pattern renderer

**What to build:** One shared **Pattern renderer** (CONTEXT.md) that draws a Pattern's cells onto a **Drawing surface**, for any Technique and Bead form factor, so a bead looks the same in the editor, the Convert image preview and the exports. It takes the Pattern's cells, the Technique's geometry, the visible region, the zoom, the rotation and a replaceable function that draws a single bead. Only today's look is implemented (ADR 0018, "visually indistinguishable" from the DOM rendering); the replaceable bead-drawing function exists so a richer look can come later without rewriting the renderer. Nothing in the app uses it yet: the editor and the framing preview move over in later tickets, and PNG/PDF export (73, 74) build on it.

Reworked from its original "prefactor for the exports" scope by the performance plan (ADR 0018). It no longer waits for the architecture review (65): the renderer's boundary is settled by that ADR, and 65 stays open for whatever else it covers.

**Blocked by:** 103 (Measurement tools and stored-data compatibility)

**Status:** done

- [x] The renderer draws a Pattern for loom, peyote and brick stitch: peyote's half-cell stagger, tighter row packing and rounded beads, and brick stitch's seam between rows, exactly as the DOM grid does today
- [x] It draws only the cells inside a given visible region, at a given zoom and 90° rotation, and stays crisp at every zoom and on high-density screens
- [x] Empty cells, painted cells, and cells in finished rows (dimmed and greyscale, with the dimming computed directly rather than through canvas filters, which iPad Safari lacks) all draw as today
- [x] The look matches the reference screenshots from ticket 103 (all fixtures, all zooms, rotated) within the agreed tolerance
- [x] The single-bead drawing is a replaceable function; the renderer has no other knowledge of how a bead looks
- [x] Unit tests cover at least one Technique per geometry, an unpainted Pattern, a Pattern taller and wider than the visible region, and a rotated Pattern
- [x] No behaviour of the running app changes

## How it came out

- `src/rendering/patternRenderer.ts` (`renderPattern`, and the geometry it draws by) and `src/rendering/beadLook.ts` (the replaceable `BeadDrawer`, today's `drawFlatBead`, the colors, and `greyscale`). The renderer draws onto anything with the canvas 2D drawing calls (`DrawingContext`), so its unit tests use a recording stand-in: 35 tests covering each Technique's geometry, an unpainted Pattern, a region of a Pattern larger than it, rotation, finished rows in both directions, the pixel ratio, and the bead drawer. Nothing in the app uses it yet; the visible region is given in displayed px (zoomed and rotated), so a surface that follows the scroll asks for what is in view and the cost follows that, not the Pattern's size.
- **Brick stitch's rows are 21 px apart, not 20.** The DOM grid gives each brick row a 1px `border-top` seam that takes layout height of its own, so a brick Pattern's grid has always been one pixel per row taller than `rowHeightPx`/`gridHeightPx` (domain/grid.ts) say, which the rulers and the box around the Pattern are sized from. The renderer draws what the DOM grid actually draws (`rowPitchPx`), so the look matches; the domain functions are untouched, so the mismatch is still there for tickets 105 and 106 to settle (the box has to be sized from the renderer's extent, and hit-testing has to use it). Worth a fix of its own: at 90 brick rows the rulers drift by 89 px at 100% today.
- **Verified against ticket 103's references** in a real browser (`e2e/visual/renderer.spec.ts`, runs in CI with the rest of the visual check): plain and Row progress (marker put back by the harness) for all three Techniques at 25%, 100%, 300%, upright and rotated. At 100% and 300% loom and upright peyote match the DOM to the block; brick and rotated peyote are within a few percent. Every bead's centre is the right color in every case, dimmed greys included.
- **The tolerance for renderer against DOM** is looser than the DOM's own (which is exact), because a canvas and a DOM grid never land on the same pixels: the DOM snaps a scaled box's inside to whole pixels its own way. It is a per-Technique share of 4x4-to-24x24 blocks whose average color differs (see the spec's header for the numbers and what they can and cannot see), plus the exact bead-color check. It cannot see a slightly different corner radius; ticket 105's in-app comparison and human eyes on the screenshots do.
- The DOM references were regenerated with the app's line height pinned to whole pixels (`e2e/support/app.ts`), because the 145% line height left the grid on a fractional pixel and blurred every edge of the 100% references; the layout is otherwise unchanged.
- `beadCentre` in the check helpers now uses the renderer's geometry, which corrects where the visual scenarios aim on brick stitch (they were up to 9 px off by the last row).
