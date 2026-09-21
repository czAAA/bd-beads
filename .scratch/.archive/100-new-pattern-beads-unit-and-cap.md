# 100: New Pattern form: beads by default, with a 10,000-cell cap

**What to build:** In the New Pattern form, Pattern size can be stated in beads, which becomes the default unit next to mm and cm. Creating a Pattern, and Convert image, are refused above 10,000 cells in total, in every unit, with a message that speaks in the unit the user is working in. Reasoning and the measurement behind the cap: [ADR 0017](../docs/adr/0017-grid-is-the-size-mm-is-an-estimate.md); CONTEXT.md (Pattern size).

**Blocked by:** None (can start immediately). It touches the same size math as ticket 99, so expect merge conflicts if both are in flight; that is a scheduling note, not a dependency

**Status:** done

- [ ] The unit select offers **beads** (default), **mm** and **cm**. In beads, Width and Height are whole numbers of at least 1 and are the Pattern's columns and rows directly. In mm/cm the existing conversion runs once, through the chosen Bead
- [ ] The slow-framing hint and Convert image's frame read the same columns and rows in every unit
- [ ] The cap is **10,000 cells (columns × rows)**, one shared constant that Resize (ticket 101) reuses. It limits the product, so neither input gets a per-side maximum on its own: 500 × 10 is fine and 200 × 200 is not
- [ ] In mm/cm the cap is judged on the grid the size converts to for the chosen Bead, so the same physical size can pass with one Bead and be refused with a smaller one. The check re-runs when the Bead, Technique, width or height changes
- [ ] A refusal disables Create and Convert image and shows an inline message in the unit being used. In beads: "That's {n} beads; the limit is 10,000." In mm/cm it names the Bead and says how tall (or wide) the Pattern can be at the current width (or height), e.g. "With TOHO Round 11/0 a Pattern can hold up to 10,000 beads. At this width, that's up to {h} cm tall." It is never only a bare cell count. The suggested maximum, typed back in, is accepted
- [ ] The wording is exposed so ticket 101 can reuse it for a Resize that would grow past the cap
- [ ] Both EN and RU strings, including the unit label for beads
- [ ] Tests cover each unit, the cap boundary (exactly 10,000 passes, 10,001 is refused), the same mm/cm size passing for one Bead and refused for another, and the Bead-change re-check
