# Three Techniques, each drawn and measured in its real geometry

**Status: accepted.** Tickets 06, 121, 319, 351.

A Project is woven in one **Technique** (CONTEXT.md), chosen when it is created and changeable on an open Project from the Frame menu (ticket 351): loom, peyote or brick stitch. The editor draws each the way the piece really looks, not as a plain grid of squares, because a weaver reads the drawing against the beads in hand.

- **Loom** rows stack straight.
- **Peyote and brick stitch** shift every other row half a bead sideways, so beads interlock (`rowOffset`). Peyote's rows nest into each other, packed at three quarters of a bead's height (`rowPitch`); brick stitch's rows sit at full height, like coursed brickwork, and are drawn with a 1px seam between rows, a drawing choice only ([ADR 0010](0010-convert-image-fixed-physical-size.md)).
- **A piece begins on an unshifted row**, so on peyote and brick stitch a Frame always starts on an even row and moves and resizes in steps of two rows (`domain/frame.ts`). Rotate on these Techniques changes which beads touch ([ADR 0026](0026-open-canvas-and-frame.md)).
- **Changing the Technique changes only the geometry.** The grid keeps its columns, rows, Bead and Frame, and every cell keeps its row and column, so a picture drawn for one Technique looks different in another; it is not converted. A Frame that began on an odd row takes in the empty row above it when the new Technique is peyote or brick stitch. It is one Undo step and waits while Row progress is on, as any change of the Frame does ([ADR 0036](0036-every-undoable-change-goes-through-edit.md)).
- The geometry lives once, in `domain/grid.ts`, and everything that places a bead reads it: the renderer, hit-testing, the rulers, Convert image's sampling, the exports.

**Considered options**: one square grid for every Technique, with the stagger left to the weaver (rejected: the drawing no longer looks like the piece, and Convert image would sample the wrong points); a Technique switch that converts the picture to look the same (not built: the same positions mean different neighbours in each Technique, so there is no faithful conversion; a separate ticket if wanted).
