# 124: Progress bar — Row progress controls move onto the canvas

**What to build:** Row progress's moment-to-moment controls move out of the Toolbox and onto the canvas itself, as a new small control called **Progress bar** (see CONTEXT.md and [ADR 0005](../docs/adr/0005-tools-above-canvas.md)'s 2026-09-22 amendment for the full design record).

Today the Toolbox's Row progress group has five controls: Enabled toggle, Direction toggle, a "row X of Y" readout, Previous, Next. Enabled and Direction stay in the Toolbox — they're set once per session. The readout, Previous and Next move to the canvas panel as Progress bar: a "row X of Y" readout plus icon-only Previous/Next buttons, doing exactly what the Toolbox buttons do today (move the current-row pointer, disabled at either end).

Where Progress bar sits depends on the open Pattern's **Pattern shape** — its rendered grid box's width vs. height (technique row-packing and Rotate both affect this; raw column/row counts don't), independent of Row direction and Rotate:

- **Vertical** Pattern (rendered width < height): Progress bar reflows into its own column on the canvas panel's right edge, next to the grid — readout on top, Previous/Next stacked below it.
- **Horizontal** Pattern (width ≥ height, including square): Progress bar reflows into its own row, stacked directly below the existing zoom cluster's row (not merged with it) — Previous, readout, Next, side by side.

Both placements are `position: sticky`, so Progress bar stays reachable while scrolling a tall Pattern regardless of which shape it falls into. It reserves no space and renders nothing while Row progress is off, matching how the existing on-canvas Row progress marker (the current-row outline) already only draws when enabled — that marker is unchanged by this ticket.

**Blocked by:** None (can start immediately)

**Status:** ready-for-agent

- [ ] A Pattern-shape helper computes vertical/horizontal from the rendered grid box (technique- and rotation-aware), not raw column/row counts
- [ ] Progress bar renders on the canvas panel: a "row X of Y" readout plus Previous/Next icon-only buttons, moving the current-row pointer exactly as the existing Toolbox buttons do today, disabled at either end the same way
- [ ] For a vertical Pattern, Progress bar sits in its own reflowed column on the canvas panel's right edge, next to the grid, readout-on-top with Previous/Next stacked below
- [ ] For a horizontal Pattern, Progress bar sits in its own reflowed row, stacked directly below the zoom cluster's row (not merged with it), Previous/readout/Next side by side
- [ ] Both placements use `position: sticky`, staying visible while scrolling a tall Pattern regardless of Pattern shape
- [ ] Progress bar reserves no space and renders nothing whenever Row progress is off
- [ ] The Toolbox's Row progress group keeps only the Enabled and Direction toggles; the position readout and Previous/Next buttons no longer render there
- [ ] Existing hotkeys (P, D, Enter, Shift+Enter) keep working unchanged
- [ ] The existing Row progress marker (the current-row outline on the grid) is unaffected
