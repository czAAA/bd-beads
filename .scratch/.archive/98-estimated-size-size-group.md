# 98: Estimated size on the open Pattern (Size group)

**What to build:** While a Pattern is open, a new **Size** Tool group in the Toolbox shows its Estimated size, for example "≈ 3.3 × 6.6 cm", with an orange warning tooltip explaining that it is an estimate. Read-only in this ticket: it is the home that Resize (ticket 101) adds inputs to. Terms and reasoning: CONTEXT.md (Estimated size, Pattern size) and [ADR 0017](../docs/adr/0017-grid-is-the-size-mm-is-an-estimate.md).

**Blocked by:** None (can start immediately)

**Status:** done

- [ ] A Size Tool group appears in the Toolbox while a Pattern is open, following the Toolbox's existing rules for Tool groups (ADR 0005)
- [ ] It shows the Pattern's Estimated size: width = columns × (the Bead's width + its width correction, if any), height = rows × the Bead's height. This is deliberately not technique-aware (ADR 0017), and the same formula is reusable outside the group (ticket 99 reads it)
- [ ] The value is shown in cm with one decimal ("≈ 3.3 × 6.6 cm"), or in mm when a side is under 10mm. Width first. The unit label follows the app language (cm/см)
- [ ] Width and height follow the rotated view on screen: rotating the Pattern swaps them, like the grid summary does
- [ ] An info icon beside the estimate opens an **orange** (warning color) tooltip. It works on hover and keyboard focus, not hover only. Suggested copy (EN): *These sizes are an estimate. We work them out from the size of one bead multiplied by how many beads you have across and down. A real piece often comes out a little different: thread, tension and small differences between beads all add up. Treat it as a guide, not a measurement.* RU translation to match
- [ ] The estimate updates when the Pattern's Bead changes
- [ ] Tests cover the estimate for all three catalog Beads (including TOHO Round 11/0's width correction), both rotations, and the formatting boundary between mm and cm
