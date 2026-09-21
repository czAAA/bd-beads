# 67: Pattern renderer

**What to build:** One shared **Pattern renderer** (CONTEXT.md) that draws a Pattern's cells onto a **Drawing surface**, for any Technique and Bead form factor, so a bead looks the same in the editor, the Convert image preview and the exports. It takes the Pattern's cells, the Technique's geometry, the visible region, the zoom, the rotation and a replaceable function that draws a single bead. Only today's look is implemented (ADR 0018, "visually indistinguishable" from the DOM rendering); the replaceable bead-drawing function exists so a richer look can come later without rewriting the renderer. Nothing in the app uses it yet: the editor and the framing preview move over in later tickets, and PNG/PDF export (73, 74) build on it.

Reworked from its original "prefactor for the exports" scope by the performance plan (ADR 0018). It no longer waits for the architecture review (65): the renderer's boundary is settled by that ADR, and 65 stays open for whatever else it covers.

**Blocked by:** 103 (Measurement tools and stored-data compatibility)

**Status:** ready-for-agent

- [ ] The renderer draws a Pattern for loom, peyote and brick stitch: peyote's half-cell stagger, tighter row packing and rounded beads, and brick stitch's seam between rows, exactly as the DOM grid does today
- [ ] It draws only the cells inside a given visible region, at a given zoom and 90° rotation, and stays crisp at every zoom and on high-density screens
- [ ] Empty cells, painted cells, and cells in finished rows (dimmed and greyscale, with the dimming computed directly rather than through canvas filters, which iPad Safari lacks) all draw as today
- [ ] The look matches the reference screenshots from ticket 103 (all fixtures, all zooms, rotated) within the agreed tolerance
- [ ] The single-bead drawing is a replaceable function; the renderer has no other knowledge of how a bead looks
- [ ] Unit tests cover at least one Technique per geometry, an unpainted Pattern, a Pattern taller and wider than the visible region, and a rotated Pattern
- [ ] No behaviour of the running app changes
