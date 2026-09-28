# 177: Convert image: snap colors to current Palette

**What to build:** Amend ADR 0011 to allow Convert image to quantize a picture's colors to the app's current Palette colors (nearest-color match), superseding the ADR's prior rejection of palette snapping. Lower the effective max-colors floor accordingly, down from today's minimum of 2.

**Blocked by:** None (can start immediately)

**Status:** done

- [ ] ADR 0011 updated to document the new palette-snap behavior and why it supersedes the earlier decision
- [ ] Convert image quantizes to the nearest current-Palette color
- [ ] Max-colors control's floor is lowered below today's minimum of 2 (new floor documented in the ADR)
- [ ] Existing near-exact-snap behavior's fate (kept as an option, or replaced) is documented in the ADR and matches what's implemented
