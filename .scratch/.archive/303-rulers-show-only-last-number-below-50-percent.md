# 303: Below 50% zoom a ruler shows only its last number

**What to build:** Zoomed out below 50%, each ruler stops numbering every Nth bead (the Ruler step, ADR 0033) and shows only its last number: a 100×13 area shows just "100" along the columns and "13" along the rows. From 50% up the Ruler step works as ticket 298 made it. The rule covers every ruler, Piece and Frame alike; where the Frame draws numbers on both sides, each side shows its own last number. The cut is sharp at 50%, with no intermediate steps. The last number stays clickable and selects its whole row or column; the hidden numbers can't be clicked. The cursor and Row progress highlights only appear on a number that is drawn, and no extra number is drawn for them. Use the glossary terms Ruler step and Rulers toggle (CONTEXT.md).

Background: decided in a grilling session. 298 (merged) thins the numbers through the Ruler step down to 10%; this replaces the thinning below 50% with "last number only". The Rulers toggle (260) still hides every number.

**Blocked by:** None (can start immediately). Branch from fresh `origin/main`: 298 and 302 are merged there.

**Status:** done

- [ ] At 50% and above the numbers are exactly as today
- [ ] Below 50% every Piece ruler and every Frame side shows only its last number (column count along columns, row count along rows), with and without a Frame
- [ ] Clicking the last number selects its row or column; with the numbers hidden there is nothing to click for the others
- [ ] The cursor and Row progress highlights show only on a drawn number
- [ ] CONTEXT.md's Ruler step entry and ADR 0033 say the Ruler step applies from 50% up and below it only the last number shows (the Rulers toggle entry already says so)
- [ ] The design system's Rulers card and its README changelog say the same (DESIGN.md §6)
- [ ] Unit tests for the label choice at 49% and 50%, and a visual test of the rulers at 25% and 10%
- [ ] Overview and Tour question (CLAUDE.md): not asked, the Tour is switched off

**Open for a human:** what the Ruler dots (ticket 299, not yet built) do below 50%. This ticket assumes they stay as 299 specifies, so the beads without a number still show dots and stay clickable. If the dots should go too below 50%, say so before 299 is implemented.
