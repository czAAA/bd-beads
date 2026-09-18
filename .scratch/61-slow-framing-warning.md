# 61: Warn per-Technique when a Pattern's size risks slow framing

**What to build:** The New Pattern form shows a non-blocking info note near the Convert image file input when the Bead + Technique + size already dialed in would produce a cell count too large for the framing preview to stay smooth. It updates live as Bead, Technique, width, height or unit change — the same fields the form already watches for its `draft` emit — and appears before any picture is chosen, so the cost is known ahead of committing to a file.

Framing (ticket 58, ADR 0010) renders one positioned DOM element per bead and re-samples the whole lattice on every pointer move of a drag; `PREVIEW_MAX_CELLS` (currently 12,000, see [imageFraming.ts](../src/domain/imageFraming.ts)) is the budget that was tuned for that to stay smooth, and it caps only the *surrounding* context — the frame itself is always rendered whole. A 300×300mm Pattern in any catalog Bead already blows past that on the frame alone (Delica: ~43,400 cells; TOHO Cube: 40,000; TOHO Round: ~18,500), which is exactly the case this warns about before the user gets there.

Each Technique gets its own message and its own threshold constant so they can be tuned independently later, but there is no profiling data today showing one Technique actually gets laggy at a different cell count than another — the render cost scales with cell count, not with stagger or row packing. **Decision:** all three start at the same number, `PREVIEW_MAX_CELLS` (12,000), as a starting guess; do not merge the three constants into one, so a future ticket can move just one of them once someone has actually felt one Technique lag before another.

Deliberately **out** of scope: changing `PREVIEW_MAX_CELLS` itself or how the framing preview renders (virtualizing it, raising the cap) — this ticket only adds an earlier, informational heads-up using the budget as it already stands.

**Acceptance criteria:**
- [ ] A per-Technique cell-count threshold exists as three independently named constants (loom / peyote / brick), all starting at `PREVIEW_MAX_CELLS`
- [ ] The New Pattern form shows a localized (English + Russian) info hint, in the Convert image field, once the current Bead + Technique + size implies a grid (`computeGridDimensions`) with cell count ≥ that Technique's threshold, and hides it otherwise
- [ ] The hint's wording names the Technique and says framing may be slow at this size — it is a plain hint, not styled as the field's error state
- [ ] The hint updates live as any of Bead, Technique, width, height or unit change, with no need to resubmit the form or pick a file first
- [ ] The hint never disables the file input or blocks conversion — informational only
- [ ] Unit tests cover: just under threshold (hidden), at threshold (shown), just over (shown), and switching Technique alone flips it on/off at an unchanged physical size and Bead

**Blocked by:** None (can start immediately)

**Status:** ready-for-agent
