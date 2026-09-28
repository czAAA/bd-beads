# 179: New Pattern unit picker: computed size-conversion row

**What to build:** Add a computed row to the New Pattern unit picker header showing both axes' bead-to-real-world conversion (e.g. "100×{beadsW} × 100×{beadsH} ≈ 15.0 × 15.0 cm"), with an "(i)" tooltip explaining it's a mathematical estimate that may differ in the real world.

**Blocked by:** None (can start immediately)

**Status:** done

- [ ] Unit picker header shows the bead-count × real-world-size conversion for both width and height
- [ ] "(i)" tooltip explains, in plain language, that this is an estimate and real results may vary
- [ ] Updates live as width, height, unit, or bead selection changes
