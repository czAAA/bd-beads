# 351: Change the Technique of an open Project from the Frame menu

**What to build:** Today a Project's Technique is chosen only when it is created. Let a person change it on an open Project, from a Technique option (loom, peyote, brick stitch) in the Frame menu: the Dock's Frame sheet and the phone Frame sheet. The grid keeps its columns, rows, Bead and Frame; only the geometry changes (row shift and row pitch), so each cell keeps its row and column. It is one Undo step, goes through `edit` like every other undoable change (ADR 0036), and saves, reloads and exports with the new Technique.

While Row progress is on the option is disabled, because Row progress follows the rows' geometry. Its Tooltip says why, like every other disabled control: "Turn off Row progress to change the Technique." (Russian too). It is a control-registry action (ADR 0035) with English and Russian name and body, and its row is added to ticket 334's copy table. `CONTEXT.md` says the Technique can change on an open Project and what happens to the cells.

Not in scope: converting the picture so it looks the same in the new geometry (a separate ticket if wanted), and a Technique option in the header Menu.

**Spec:** 343 (unified controls spec)

**Blocked by:** 336 (Dock and phone sheets on the shared controls), 334 (tooltip copy)

**Status:** done

- [x] Frame menu on the Dock and on the phone offers Technique with loom, peyote and brick stitch; the current one is marked
- [x] Choosing another Technique redraws the canvas in its geometry; columns, rows, Bead, Frame and every cell's row and column are unchanged
- [x] One Undo step brings back the previous Technique; Redo reapplies it
- [x] With Row progress on the option is disabled and its Tooltip gives the reason, in English and Russian
- [x] The new Technique survives save, reload and file export
- [x] Copy added to ticket 334's table; `CONTEXT.md` updated
- [x] The tests related to the changed files pass; update the visual baselines where the look changed on purpose
