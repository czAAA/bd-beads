# 22: Live mirror while drawing

**What to build:** Replace the discrete "Apply mirror" command with live per-stroke mirroring, fixed to the grid's exact center axis. Add two small "Mirror current" buttons (one per axis) for one-time syncing of already-painted content, reusing the old "bigger half" heuristic. See [ADR 0006](../docs/adr/0006-live-mirror-while-drawing.md).

**Blocked by:** None (mirror already exists per ticket 09; this changes its behavior)

**Status:** ready-for-agent

- [ ] The master "mirror enabled" checkbox is removed; horizontal and vertical toggles alone control mirroring (either, both, or neither)
- [ ] The "Apply mirror" button is removed
- [ ] While the Paint tool is active and a toggle is on, painting a cell also paints its mirrored counterpart(s), computed as a reflection across the grid's exact center — 2 cells with one axis on, 4 with both
- [ ] Fill is unaffected by mirror state (mirror toggles don't change Fill's behavior)
- [ ] Two new buttons, "Mirror current (horizontal)" and "Mirror current (vertical)", are always enabled and each do a one-time reflect of whatever's currently painted across that axis, using whichever half has more painted cells as the source (today's heuristic)
- [ ] Mirror-driven grid changes (live paint mirroring and "Mirror current") are undoable as a single step, same as an unmirrored paint
