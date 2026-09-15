# 01: Create and persist a blank Loom pattern

**What to build:** End-to-end, a user picks a Bead from the pre-seeded catalog, enters a pattern size in cm/mm, and creates a new Pattern using the Loom Technique (the only technique this ticket covers). An empty grid renders with the right dimensions and the Pattern autosaves to localStorage, surviving a reload.

**Blocked by:** None (can start immediately)

**Status:** done

- [ ] User can start a new Pattern, choosing a Bead from the seeded catalog (TOHO Cube 1.5mm, TOHO Round 11/0, Miyuki Delica 11/0) and Loom as the Technique
- [ ] User enters pattern size in cm or mm; the app converts it into a bead grid (columns × rows) using the selected Bead's size
- [ ] An empty rectangular grid renders matching that column/row count
- [ ] The Pattern (technique, bead, dimensions, empty grid) persists to localStorage without an explicit save action
- [ ] Reloading the app shows the previously created Pattern unchanged
