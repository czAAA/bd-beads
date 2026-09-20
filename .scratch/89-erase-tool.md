# 89: Erase tool

**What to build:** A 4th tool, Erase, selectable by clicking its own button in the Tools group: clicking a cell flood-erases its connected same-color region, using the same flood algorithm as Fill but writing empty instead of a color. It behaves exactly like every other drawing command — one Undo step, respects the Row progress lock, and honors Mirror (erasing a cell also erases its mirrored counterparts). The existing right-click erase under Paint/Fill (single-cell/dragged-line, and flood-erase) is unchanged and coexists with this new tool.

**Blocked by:** None (can start immediately)

**Status:** ready-for-agent

- [ ] Erase tool button appears in the Tools group, selectable by click
- [ ] Clicking a painted cell with Erase active clears the connected same-color region (flood), reusing Fill's algorithm
- [ ] Erase respects the Row progress lock (skips finished rows) and is one Undo step
- [ ] Erasing inside active Mirror axes also clears the mirrored counterpart cells
- [ ] Right-click erase under Paint and Fill is unaffected by the new tool
- [ ] CONTEXT.md gets a new "Erase" Language entry, and the Tool group entry's example list is updated to include it
