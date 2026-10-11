# BeadCursor

The keyboard cursor on the Pattern: one bead ringed in `focus-ring`, its row and column marked on the rulers.

- The ring is 2px `focus-ring`, 2px outside the bead, following its corners (3px in high contrast). Only after keyboard focus reaches the Pattern (`:focus-visible`).
- The rulers mark the cursor's row and column: `ink`, bold, a 2px `focus-ring` line under the number.
- Arrows move one bead (Shift extends a Selection), Home / End go to the row's ends, Page Up / Down move ten rows, Space or Enter uses the current tool, Escape leaves. With Paint and a colour, the bead under the cursor previews it at 60%.
- The canvas strip shows "arrows move · space paints · esc leaves" while the Pattern has focus; the view keeps the cursor two beads from any edge.
- Screen readers hear "Row 4, column 5, orange" as it moves and "Painted blue" after Space (polite).

Hand-written from the Phase E sign-off.
