# 38: Remove the Bead catalog section and custom Beads

**What to build:** The Bead catalog section below the canvas is removed, and so is the ability to add, edit or remove custom Beads. The Bead catalog becomes a fixed built-in list of three Beads: TOHO Cube 1.5mm, TOHO Round 11/0 and Miyuki Delica 11/0. The New Pattern form's Bead picker offers exactly those three.

**Blocked by:** None (can start immediately)

**Status:** ready-for-agent

**Decisions (2026-09-16):**
- Recorded in ADR 0007 (already written): the Bead catalog is a fixed built-in list.
- Custom Beads added earlier are no longer loaded or offered anywhere; their stored data is ignored (or cleared).
- Existing Patterns created with a custom Bead keep working: their grid size is stored on the Pattern, so they open, edit, export and import normally. The header shows them as "unknown bead" (ticket 37).

- [ ] The Bead catalog section no longer renders anywhere in the app
- [ ] The New Pattern Bead picker lists exactly the three built-in Beads, even if custom Beads were saved before
- [ ] A Pattern created with a since-removed custom Bead still opens, can be painted, and exports/imports
- [ ] Custom Bead storage, the catalog component, its translation strings (both languages) and its tests are removed
- [ ] CONTEXT.md's Bead entry describes the catalog as a fixed built-in list, no longer saying the user can add more
