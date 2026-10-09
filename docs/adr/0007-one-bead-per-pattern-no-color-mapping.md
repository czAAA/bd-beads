# One Bead per Project, from a fixed catalog; Replace Bead keeps the beads

**Status: accepted.** Tickets 36–38, 48, 98. Code catches up in ticket 366 (Bead colors).

A Project is woven from exactly one **Bead** (CONTEXT.md): a Bead line such as TOHO Round 11/0, with its shape and footprint in mm. It is chosen when the Project is created and shown once, in the Project's info. Every color in the Project is that same Bead line, so there is no per-color Bead and no color-to-Bead mapping.

- **The Bead catalog is a fixed built-in list** (TOHO Cube 1.5mm, TOHO Round 11/0, Miyuki Delica 11/0), not user-editable. A Bead sets a new Project's bead shape and turns a size in mm or cm into beads ([ADR 0026](0026-open-canvas-and-frame.md)). A Project made with a Bead the catalog no longer has still opens, showing an unknown Bead.
- **Replace Bead keeps every bead where it is.** Only the Bead, and with it the Estimated size, changes; the confirmation says the size changes and that the Frame can be resized afterwards. It touches no bead, so it is exempt from the drawing guards ([ADR 0036](0036-every-undoable-change-goes-through-edit.md)) and is one Undo step.
- **Beads needed counts colors**: each painted color inside the Frame and how many beads have it.
- **Decided, not built:** each Bead line gets its **Bead colors**, the real colors with the maker's codes, which make up the Color catalog ([ADR 0002](0002-palette-separate-from-bead-catalog.md)). A color picked from it is a Bead color of the Project's Bead, and Beads needed names it by its code; any other hex is still listed by color only.

**Considered options**: a global color-to-Bead mapping with per-Project overrides (built, then dropped in ticket 36: bookkeeping without information once a Project has one Bead line); user-editable custom Beads (dropped in ticket 38: the built-in lines cover what a Bead is for); recomputing the grid on Replace Bead to keep the real-world size (built in ticket 48, reversed in ticket 98: a weaver counts beads, the millimetres are an estimate, and resampling a drawing loses it).
