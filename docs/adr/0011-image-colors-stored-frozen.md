# Image colors are stored frozen, and are Palette colors

**Status: accepted.** Tickets 58, 177.

Convert image reduces a picture to a few colors and matches each to its nearest built-in Palette color (`resolveImageColors`, `nearestColor` in `domain/imageColors.ts`), so a converted Project paints with the same colors as every other one. Two near-identical shades in flat artwork may collapse onto one color; that loss is accepted for one color story. The max-colors floor is 1, for a single-color silhouette.

The resulting set is saved on the Project as **Image colors** and never changes afterwards, even though it could be recomputed from the beads at any time. It is offered beside the Palette while that Project is open, as a short list of the colors this picture used. Frozen, not kept in sync: any rule that adds painted colors or drops erased ones is derivation by another name, with its own edge cases (a color erased and repainted, the order of a growing list).

**It coexists with the stored color table, and the two must not be merged** ([ADR 0009](0009-compact-grid-encoding.md)): that table describes the beads now, Image colors the conversion. They differ the moment a color is erased, and both are then correct.

**Considered options**: deriving the list from the beads on demand (rejected: it changes the Colors group for every Project, not only converted ones); keeping picture-only hexes unmatched to the Palette, as first built (reversed in ticket 177: a converted Project's colors were reachable nowhere else in the app).
