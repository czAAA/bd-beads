# 160: High contrast theme and forced colors

**What to build:** The third theme, High contrast, looks right everywhere, as `accessibility.md` and the HighContrastTheme and ContrastAudit cards describe: text at least 7:1, every line 2px, every surface white, no elevation, a 3px black focus ring, and bead colors unchanged. It follows `prefers-contrast: more` while the theme control is on Match device. With Windows `forced-colors: active`, system colors win and outlines, borders, focus, the active tab and the open Pattern stay visible.

**Blocked by:** 139, 140

**Status:** ready-for-agent

- [ ] Every screen and state checked in high contrast against the ContrastAudit card; each failure fixed
- [ ] The canvas renderer's `PatternTheme` has a high contrast variant (board, rulers, marker, cursor); bead colors are never altered
- [ ] Forced colors mode keeps every control's edge and every selected state visible
- [ ] No state relies on color alone: each has a shape or a word too
