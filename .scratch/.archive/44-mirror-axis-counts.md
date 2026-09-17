# 44: Mirror axis counts per direction, with visible axes

**What to build:** The Mirror group replaces its two on/off toggles with two counters, "Left–right" and "Top–bottom", each with decrease/increase arrows stepping by one from 0 (that direction off) up to one fewer than the number of cells across that direction. N axes split the grid into N+1 equal strips; painting a cell with the Paint tool also paints its counterpart in every other strip, with neighbouring strips mirror images of each other (A | A′ | A). With 1 axis this behaves exactly like today's center mirror. While either count is above 0, the axes are drawn on the canvas as super-thin but clearly visible lines, whatever tool is active.

All of this sits behind a **rich mirror** feature flag, introduced by this ticket, so it can be switched off if something goes wrong. With the flag off, the Mirror group and live mirroring stay exactly as they are today: two on/off toggles mirroring across the grid's center, no axis counts, no axis lines. The flag is a build-time env variable, `VITE_RICH_MIRROR`: enabled for local development, disabled for the GitHub Pages build.

**Blocked by:** 40

**Status:** ready-for-agent

**Decisions (2026-09-16):**
- See CONTEXT.md **Mirror** and the amendment note on ADR 0006.
- Uneven splits: an axis may pass through the middle of a cell, which then mirrors onto itself (as today's center axis does for odd sizes); strips are as equal as possible.
- Upper bound per direction is cells − 1, so every axis has at least one cell on each side.
- Directions are named by what they do on screen. Rotating the Pattern swaps the two counts, so "Left–right" stays left–right as seen.
- Counts are an editing-session setting: not saved with the Pattern, reset to 0 on a Pattern switch.
- Counters take a full row each in the group and don't count toward the 14 slots (ticket 40).
- Fill and Paste remain unaffected by Mirror; live mirroring applies to the Paint tool (paint and erase strokes), and the hover preview shows every counterpart.
- Mirror current keeps its current behaviour until ticket 46.
- Feature flag: on only when `VITE_RICH_MIRROR` is exactly `true`; missing or any other value means off, so production is safe by default. Commit `.env` with `VITE_RICH_MIRROR=false` and `.env.development` with `VITE_RICH_MIRROR=true` (`npm run dev` uses development mode; `npm run build`, as used by the Pages workflow, uses production). No change to the deploy workflow needed.
- The flag is read in one place (a small feature-flags module) so every rich-mirror ticket (44–47) checks the same switch and tests can set it either way.

- [ ] Each counter shows its value; decrease is disabled at 0, increase at cells − 1
- [ ] Count 0 in both directions: painting affects only the painted cell and no axes are drawn
- [ ] 1 left–right axis: painting mirrors across the vertical center exactly as before
- [ ] N axes: a painted cell also paints its mirror-image counterpart in every strip; erase strokes do the same
- [ ] Both directions set: counterparts cover every combination of strips
- [ ] Axes render as thin visible lines at the right positions (cell boundaries or through cell middles) for any tool
- [ ] Rotating swaps the two counts; switching Patterns resets both to 0
- [ ] Works for loom, peyote and brick stitch Patterns
- [ ] With the flag off, the Mirror group shows today's two toggles and two Mirror current buttons, painting mirrors across the center only, and no axis lines are drawn — existing mirror tests pass unchanged
- [ ] `npm run dev` has the flag on; `npm run build` output has it off
- [ ] Tests cover both flag states
