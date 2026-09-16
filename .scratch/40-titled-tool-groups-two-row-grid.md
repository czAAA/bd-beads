# 40: Titled Tool groups in a two-row grid

**What to build:** The Toolbox is reorganised into five titled Tool groups, in this order: Tools (Paint, Fill, Select), Colors (the Palette), Edit (Undo, Rotate, Copy), Mirror, Row progress. Each group shows a small, understated title in its top-left corner. Inside a group, controls flow left to right across two rows, at most seven per row, so a group is only as wide as its contents need: a three-control group is narrow, the Colors group is wide. Text and numeric controls (e.g. Row progress's "row X / Y" readout) take a full row of their own and don't count toward the 14-slot grid.

Prefactor first, as its own commit with no behaviour change: move the Toolbox markup and its handlers out of the app shell into a Toolbox component, since tickets 41–47 all build on this area.

**Blocked by:** None (can start immediately)

**Status:** ready-for-agent

**Decisions (2026-09-16):**
- Glossary terms: **Toolbox** (the whole strip above the canvas) and **Tool group** (one titled box in it). Avoid "subbox", "card", "tool strip".
- Controls fill row-major: with three controls, two sit on the top row and one below.
- The previously untitled Undo/Rotate/Copy group becomes "Edit".
- Titles are translated (English and Russian).

- [ ] The prefactor lands first with the existing test suite passing unchanged
- [ ] Five Tool groups render in the order Tools, Colors, Edit, Mirror, Row progress, each with its title in the top-left corner
- [ ] Controls lay out left to right in at most two rows of seven; a group with three controls is visibly narrower than Colors
- [ ] Text/numeric controls occupy a full row and are not counted toward the 14 slots
- [ ] Titles appear in both languages
- [ ] At phone width the Toolbox still fits without horizontal page scroll
