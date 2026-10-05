# Zoom out to 10% everywhere; the rulers thin to dots instead of stopping the zoom

**Status: accepted.** Supersedes the per-tier zoom-out floor of ticket 223 (`bead-min-*` as the floor). Tickets 298 to 301.

## Context

Ticket 223 made the smallest zoom the smallest bead of the screen's tier, so every ruler number stayed clear: 16px beads (90%) on a phone, 15px (85%) everywhere else. Zoom out and Fit stopped there and a wider Pattern was panned, not shrunk. The floor protected the rulers but made the main thing a person wants from zooming out, seeing a Pattern wider or taller than the screen whole, impossible on the screen where it matters most. It also read as arbitrary: 85 on a landscape phone, 90 in portrait.

## Decision

- One **Zoom floor** of 10% on every screen, for zoom out, pinch, wheel, the zoom buttons and Fit. Fit is still capped at 100% and only shrinks.
- The rulers no longer set the floor; they adapt to it. The **Ruler step** is the smallest of 5, 10, 50, 100 and so on that leaves every number clear at the current zoom. Beads between numbers get a **Ruler dot**, every 5th bolder; below about 6px of bead pitch only the 5th-bead dots remain.
- A dot selects its row or column like a number does, by the nearest bead under the pointer.
- The zoom buttons move 10% at a time (10, 20, 30...); pinch and wheel stay continuous at whole-percent precision.
- Two number-size tiers stay (12px ruler numbers at phone widths, 11px above, which is the `bead-min-phone` and `bead-min-tablet` values) but they now set the point where numbers turn to dots. `bead-min-tablet-lg`, `-laptop` and `-desktop` repeat `bead-min-tablet` and are removed.

## Considered options

1. **Keep the tier floors.** Rejected: it caps what can be seen on one screen, the reason for zooming out.
2. **Lower the floor but keep every number.** Rejected: numbers collide below about 15px and become unreadable noise.
3. **Hide the rulers below the old floor.** Rejected: loses the row and column count and selection by ruler exactly when a large Pattern needs them.

## Consequences

- The Rulers card, `responsive.md`, `interaction-and-motion.md` and the tokens change in the same commit (DESIGN.md §6).
- Ruler drawing depends on zoom, so it is redrawn on every zoom change and must stay cheap at 999 columns.
- A click on a ruler at 10% lands within about 2px, so the nearest-bead pick, not a hit box per number, is the target.
- Hard to reverse: the tokens' meaning and the ruler layout change, and saved zoom preferences below the old floor become reachable.
