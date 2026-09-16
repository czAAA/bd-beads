# 45: Mirror copy mode

**What to build:** A single switch in the Mirror group toggles copy mode. With it on, strips repeat the same way round (A | A | A) instead of alternating as mirror images (A | A′ | A): painting a cell paints the cell at the same position within every other strip, in both directions.

Part of the rich mirror feature (flag introduced in ticket 44): with `VITE_RICH_MIRROR` off, the switch is not shown and mirroring stays as today.

**Blocked by:** 44

**Status:** ready-for-agent

**Decisions (2026-09-16):**
- One switch for both directions.
- Copy mode is its own switch rather than implied by the axis count, so 1 axis is still a true mirror by default (see ADR 0006 amendment).
- Editing-session setting: not saved, reset on a Pattern switch, like the counts.
- With a count of 0 in both directions the switch has no visible effect.

- [ ] The switch shows its on/off state
- [ ] With copy mode on and 2 left–right axes, painting a cell in the first strip paints the same relative cell in strips two and three, unflipped
- [ ] Turning it off returns to mirror-image strips
- [ ] Switching Patterns turns it off
- [ ] Label is translated
- [ ] With the rich mirror flag off, the copy mode switch is not rendered
