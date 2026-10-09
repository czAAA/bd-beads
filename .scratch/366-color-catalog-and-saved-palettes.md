# 366: Build a Palette from the Color catalog of real bead colors

**What to build:** Each Bead line gets its Bead colors, the real colors with their maker's codes (CONTEXT.md: Bead color, Color catalog). Anyone, a Guest included, builds their Palette from the default colors plus colors picked from the catalog; inside a Project the catalog offers the Bead colors of that Project's Bead, and Beads needed names a catalog color by its code. Pro adds Palettes saved to the account and kept in step across devices (ADR 0002, ADR 0007, ADR 0014). This is a spec ticket: grill the design (where the catalog data comes from and its license, how a Palette is built and edited, what happens to today's added Custom colors, several Palettes on the device or one) and cut it into implementation tickets.

**Blocked by:** None for the device part; 84 (plan gating) for saved Palettes

**Status:** needs-triage

- [ ] A grilling session settles the open design questions above, and ADR 0002 and ADR 0007 are rewritten to match
- [ ] Implementation tickets exist for the catalog data, building a Palette, Beads needed by code, and saved Palettes for Pro
- [ ] The ticket is archived in the same change
