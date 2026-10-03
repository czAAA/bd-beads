# Rulers

The row and column numbers around the Pattern (approved variant A). Every number is drawn, 1 upwards: on all four sides of the Frame, and above and left of each piece before a Frame is set.

- **Whose rulers (v16):** until a Frame is set, every piece carries its own rulers: column numbers above and row numbers on the left, counted from 1 at the piece's top-left corner, 3px from its rectangle. Once the Frame is set, piece rulers hide and only the Frame's show, on all four sides, counted from the Frame's top-left corner.
- **Rulers toggle:** rulers are on by default. The canvas strip's Rulers button (`ruler` icon; pressed is an `ink` fill with a `canvas` icon; first in the ZoomPill on a phone) or `R` hides and shows them.
- **Type:** the `ruler` role: DM Mono 11 on every tier, 12px on a phone (below `bp-tablet`).
- **Every 5th number** is bold in `body`; the rest are regular in `ruler`. The current row's number is weight 700 in `marker` and the keyboard cursor's is bold `ink` with a 2px `focus-ring` line under it (BeadBoard and BeadCursor cards); both win over the 5th-number style.
- **Column numbers up to 99 are horizontal.** From 100 they are turned a quarter turn and read upward, so three digits take no more width than two. Row numbers always stay horizontal.
- **Placement:** column numbers sit at the bead-side end of their 28px gutter, 3px from the Frame line or the piece rectangle, horizontal or turned; offset techniques shift them by half a bead as before. Each number keeps its own bead at every zoom level.
- **Smallest bead:** the zoom-out floor and the most Fit may shrink to, so no two numbers touch: `bead-min-phone` 16px (pitch 18px), `bead-min-tablet`, `bead-min-tablet-lg`, `bead-min-laptop` and `bead-min-desktop` 15px (pitch 17px). This holds for Patterns up to 999 columns because numbers from 100 are turned. A wider Pattern is panned, not shrunk.
- **Contrast:** `ruler` is 5.2:1 in light and 4.9:1 in dark on `box`; `body` is stronger still.

The preview shows the number styles on a v15 board; the BeadBoard and Frame cards show the piece and Frame rulers in place.

Hand-written from the approved Rulers design (claude.ai, variant A). Replace this card with the claude.ai one when the design system is next synced (DESIGN.md §6).
