# 125: Design exploration harness: sample Pattern, control checklist, screenshot script

**What to build:** The shared groundwork for prototyping the editor page once per DESIGN.md from [VoltAgent/awesome-design-md](https://github.com/VoltAgent/awesome-design-md) (`design-md/<company>/DESIGN.md`), so tickets 126–134 only have to write each prototype. The goal of the whole exploration is to pick one base DESIGN.md for the redesign by comparing screenshots; nothing it produces is committed.

**Blocked by:** None (can start immediately)

**Status:** done

- [x] `design-exploration/` is added to `.gitignore` (screenshots and prototype sources are local-only)
- [x] Sample Pattern data: the current logo (`public/favicon.svg`, 80×80, #b3382b, drawn rotated 45°) un-rotated, scaled to fit 30 rows and centered in a 40×30 loom grid, red on a light background; plus a ~8-color Palette, Row progress partly done, and 3–4 Saved Patterns entries — shared by every prototype so the comparison is fair
- [x] Control checklist derived from `src/App.vue`: every control the editor has today (top bar summary, New Pattern, Import, Toolbox groups — tools, Colors, Edit, Mirror, Row progress, Save — zoom, Progress bar, Beads needed, Saved Patterns and its exports, …), marking which are primary (tools, Colors, Undo/Redo, Progress bar, zoom, Save) and must stay visible
- [x] Font-substitution map: each proprietary font named in the DESIGN.md files → closest free Google Fonts match, used at the same type scale
- [x] Proprietary-content rules written down for the prototypes: no company/product names or brand copy, no logos/mascots/brand imagery, brand-named colors become neutral names with the same hex; hex values, spacing, radii, type scales and principles are kept exactly
- [x] A Playwright script that renders every `design-exploration/.src/<industry>/<company>/prototype.html` at 1440×900 and writes `design-exploration/<industry>/<company>/screenshot.png`
