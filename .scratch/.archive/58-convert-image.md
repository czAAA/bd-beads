# 58: Convert image — create a Pattern from a picture

**What to build:** A new Pattern can be made from a picture instead of an empty grid: the picture is shown rendered as beads at the Pattern's real size, and a frame positioned over it chooses which part becomes the Pattern.

Every cell today is painted by hand. Converting a picture is the feature other beading sites lead with, but they aim it at photographs, and a photograph at bead resolution needs dozens of colours and tens of thousands of beads — a Pattern nobody weaves. This targets flat, stylised artwork instead: logos, icons, pixel art, folk motifs. There conversion is near-lossless, the colour count stays in single figures, and the result is a weekend's weaving rather than a year's. A photograph still converts; it simply gets no machinery of its own.

- **Convert image is a creation option, not a drawing command.** It appears in the New Pattern form and produces a new Pattern. It never converts into a Pattern that is already open, so it answers to neither the Row progress lock, nor Mirror's strips, nor the undo stack — see [ADR 0010](../docs/adr/0010-convert-image-fixed-physical-size.md).
- **Real-world size stays authoritative.** Width, height, Bead and Technique are stated as for any other new Pattern and set the frame; the picture is scaled and cropped to fit it (ADR 0010). Those fields stay editable during framing and the frame follows them immediately.
- **Framing happens in the canvas panel**, in the slot the "No Pattern open yet" placeholder occupies today. Entering framing mode with a Pattern already open takes the panel over; Cancel restores it and creates nothing.
- **The bead preview is honest.** The whole picture renders as beads at the scale the frame implies, reflowing as the picture is zoomed, so what is inside the frame is always exactly the Pattern that will be created. Zoom moves the picture, not the frame, and is clamped so the picture always covers the frame.
- **Sampling honours the Technique's grid geometry.** Each cell is sampled at its true centre in millimetres, so peyote's half-cell stagger and tighter row packing and brick stitch's stagger are reproduced. A naive rectangular sample shears and squashes both, invisibly until the piece is woven.
- **Colours come from the picture, not from the Palette.** Pictures already holding few enough distinct colours are used exactly, with no quantization at all; anything busier is reduced, to a count the user can adjust live. Only near-exact matches snap to a Palette colour — see [ADR 0011](../docs/adr/0011-image-colors-stored-frozen.md).
- **Image colors are saved with the Pattern and frozen** (ADR 0011), and shown in the Colors group alongside the Palette while that Pattern is open, so a converted Pattern can actually be touched up. A Pattern created any other way is unaffected.
- **Transparency becomes empty cells.** A pixel below 50% alpha leaves its cell unpainted; at or above, it is composited over white. A transparent-background icon converts to a shape rather than a rectangle.
- **Input limits are enforced and advertised.** PNG, JPEG, GIF and WebP; at most 10MB and 16 megapixels. The limits appear as visible helper text under the file input as well as in a `title`, both localised, and are read by the validation and the strings from one set of constants so they cannot drift apart.

Deliberately **out** of scope: converting into an already-open Pattern; dithering; a catalog of real bead colours (`Bead.color` is null for all three catalog entries, and filling it is what would make a Pattern's colours purchasable — a much larger feature, see ADR 0011); marking an opaque background colour as empty after conversion; remembering a picture so a conversion can be redone with different settings.

**Blocked by:** 56 (compact grid encoding) — this adds a persisted `Pattern` field, and 56 rewrites how a Pattern is stored. Landing this second means one encoder, written once, already knowing about the field.

**Status:** ready-for-agent

**Decisions (2026-09-18):**
- **Flat artwork is the target, photographs are not.** A 10 × 10cm Pattern in Delica 11/0 is 62 × 77 = roughly 4,800 beads, and that is the small case; a photograph that reads as a photograph needs a much larger grid and dozens of separately-bought bead colours. Building for flat art is both the honest choice and the cheap one. No dithering: it scatters isolated single beads through flat areas, which is miserable to weave, hurts Row progress readability, and inflates Bead quantities with colours needed six beads of.
- **The Palette is not a procurement list, so extracted colours are not snapped to it.** ADR 0002 says a cell's colour need not match a real Bead, and all three catalog Beads have `color: null`. Snapping to the twelve Palette colours therefore costs fidelity and buys nothing, and collapses similar extracted colours into one. Near-exact snapping is kept only to avoid two indistinguishable reds in Bead quantities.
- **Frame size comes from the form, zoom moves the picture.** Both are ways to express the same crop; putting size in the form keeps one meaning for "the Pattern's size" and lets the physical fields stay live during framing. 100% is the smallest scale that covers the frame and is also the minimum, so an unfilled edge is impossible; range 100–800%, step 25%, reusing `ZoomControls` (presentational already — only the clamp range differs from `clampZoom`'s 0.25–3).
- **Image colors are stored, not derived.** Deriving is free and self-maintaining, but changes the Colors group for every Pattern in the library; storing keeps the change to converted Patterns only. Frozen, because every sync rule reintroduces derivation plus edge cases. ADR 0011 records this and, importantly, warns off merging it with ticket 56's derived colour table.
- **Cancel discards everything.** The usual reason to back out is a wrong size, and the physical fields are editable during framing, so the remaining reason is "not this picture" — which wants a fresh start, and keeps the source picture out of anything persistent.
- **HEIC is rejected with a real message.** It is what iPhones shoot by default and browsers cannot decode it, so a generic failure here would look like a bug. SVG is excluded too: it has no native resolution to sample and is an unnecessary security surface.

- [ ] A new Pattern can be created from a picture, via the New Pattern form, with the framing step in the canvas panel
- [ ] Width, height, unit, Bead and Technique stay editable during framing and the frame updates immediately
- [ ] The picture renders as beads at the frame's implied scale, reflowing on zoom; zoom clamps so the frame is always covered, and re-clamps when the size fields grow the frame
- [ ] The frame's proportions follow the Pattern's physical size, so Delica's 1.6 × 1.3mm cell does not distort it
- [ ] Cells are sampled at their true centres per Technique: peyote reproduces the half-cell stagger and 0.75 row packing, brick the stagger only, loom neither
- [ ] A PNG with few enough distinct colours converts losslessly; a busier picture is reduced to an adjustable colour count
- [ ] An extracted colour within an imperceptible distance of a Palette colour becomes that Palette colour; a visibly different one does not
- [ ] Pixels below 50% alpha become empty cells; at or above they are composited over white
- [ ] Image colors are saved with the converted Pattern, survive a reload and a Pattern file round trip, and appear in the Colors group alongside the Palette; Patterns created any other way are unchanged
- [ ] Image colors do not change when the Pattern is later painted, erased, or has its Bead replaced
- [ ] Oversize files, oversize resolutions, HEIC, SVG and corrupt files are each rejected with a localised message; an animated GIF converts from its first frame
- [ ] The limits appear in visible helper text and in a `title`, in English and Russian, from the same constants the validation uses
- [ ] Cancel creates no Pattern and restores an already-open one; re-entering starts from a clean slate
- [ ] Edge cases covered: 1×1 picture, single-colour picture, fully transparent picture, picture smaller than the grid (upscaled), two extracted colours that full snapping would have collapsed
- [ ] CONTEXT.md carries Convert image and Image colors; ADRs 0010 and 0011 are in place
- [ ] Full suite green
