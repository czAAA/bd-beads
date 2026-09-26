# 75: Apply design system to Toolbox & Tool groups

**What to build:** Restyle the Toolbox and its Tool groups per `DESIGN.md` (§3 tokens, §4.2 the Toolbox as the left column's first box, §5.4–5.7) and the design system files in `docs/design/system/`: Tools as tabs (Paint, Fill, Select, Erase, with Remove line and Delete all below), Colors (the palette swatch grid, Custom and Image colors buttons), the Edit row (Undo, Redo, Rotate, Copy), and Mirror and Size as disclosure rows that open their full controls in place below the row. Save and Export have already left the Toolbox (ticket 148) and Row progress has moved to the Progress bar (ticket 144), so the Toolbox holds only these groups.

**Blocked by:** 141, 157

**Status:** ready-for-agent

**Design system v13:** The component card(s) in `docs/design/system/components/` are the spec: Toolbox, ToolTabs, PaletteSwatches, DisclosureRow, MirrorSizeControls. The Mirror summary reads "↔ 1 · ↕ 0" in both languages.

- [ ] All existing Tool groups use the new design tokens: no hardcoded colors, fonts, sizes or shadows from the old CSS
- [ ] Every icon comes from the Icon component (ticket 137)
- [ ] Behaviour follows `DESIGN.md`: the Toolbox scrolls with the left column rather than sticking, and Mirror and Size open in place below their row (chevron turns up), closing on Escape, which closes the open row first
- [ ] The opened Mirror and Size controls (marked Derived in `DESIGN.md` §5.6) are laid out one per line with meta values, and any detail `DESIGN.md` doesn't state is added to it as Derived
- [ ] Swatch grid, selected ring, Custom and Image colors buttons (including the `--faint` empty state) match §5.5
- [ ] Matches `DESIGN.md`'s Tool group template (§5.7) and `docs/design/light.png` / `dark.png`, in both themes
- [ ] Existing Toolbox behavior, hotkeys and tests are unchanged
