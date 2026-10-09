# 356: Setting or turning a Frame that pushes Pieces out no longer freezes the page

**What to build:** when a new, moved, resized or rotated Frame leaves Pieces in its keep-out margin, they move clear (ticket 261, ADR 0027) without freezing the page. Today, on a big drawing, the page stops until the move finishes, and the person has to refresh it.

Research (reproduced in the domain, loom unless noted, a fresh 6x6 Frame in the middle of a filled drawing):

| Drawing | Before | After |
|---|---|---|
| 120x120 | 2.6 s | 0.13 s |
| 250x250 | 44 s | 0.6 s |
| 250x250 peyote | 11 s | 0.5 s |

Cause: finding the nearest empty spot for a Piece tries shifts ring by ring. On the first ring where the Piece clears the Frame, every shift was still tested, because each one nearer the centre beat the best so far, and testing one shift reads every bead of the Piece. A big Piece was scanned a few hundred times on the main thread. Nothing throws, so the page just stops.

Fix: sort each ring's shifts nearest first and take the first that fits. The chosen spot is the same as before. Set, move, resize, Fit to drawing, Remove Frame and Rotate all go through it.

Not covered: the small browser fixture did not reproduce a freeze (the Message appeared and the page stayed responsive), so the 250x250 domain timing is the evidence. The "always some mess" after a move was not seen on the fixture. If it still happens on a big drawing, open a new ticket with the project that shows it.

**Blocked by:** None (can start immediately)

**Status:** done

- [x] A failing test reproduces it: a 150x150 drawing with a fresh Frame in its middle must be moved clear in under 2 s (4.6 s before the fix)
- [x] Pieces are moved to the same spots as before, no bead lost, none left in the margin
- [x] Tests related to the margin code pass
- [x] Committed, pushed and a PR opened
- [x] The ticket is archived in the same change
