# 75: Apply design system to Toolbox & Tool groups

**What to build:** Restyle the Toolbox and its Tool groups per the design system (its tokens, the Toolbox as the left column's first box, and the `Toolbox`, `ToolTabs`, `PaletteSwatches` and `DisclosureRow` cards) and the design system files in `docs/design/system/`: Tools as tabs (Paint, Fill, Select, Erase, with Remove line and Delete all below), Colors (the palette swatch grid, Custom and Image colors buttons), the Edit row (Undo, Redo, Rotate, Copy), and Mirror and Size as disclosure rows that open their full controls in place below the row. Save and Export have already left the Toolbox (ticket 148) and Row progress has moved to the Progress bar (ticket 144), so the Toolbox holds only these groups.

**Blocked by:** 141, 157

**Status:** done

**Design system v13:** The component card(s) in `docs/design/system/components/` are the spec: Toolbox, ToolTabs, PaletteSwatches, DisclosureRow, MirrorSizeControls. The Mirror summary reads "↔ 1 · ↕ 0" in both languages.

- [x] All existing Tool groups use the new design tokens: no hardcoded colors, fonts, sizes or shadows from the old CSS
- [x] Every icon comes from the Icon component (ticket 137)
- [x] Behaviour follows `DESIGN.md`: the Toolbox scrolls with the left column rather than sticking, and Mirror and Size open in place below their row (chevron turns up), closing on Escape, which closes the open row first
- [x] The opened Mirror and Size controls (marked Derived in the `DisclosureRow` and `MirrorSizeControls` cards) are laid out one per line with meta values, and any detail the design system doesn't state is added to it on claude.ai first (`DESIGN.md` §2)
- [x] Swatch grid, selected ring, Custom and Image colors buttons (including the `--faint` empty state) match the `PaletteSwatches` card
- [x] Matches the Tool group template in the `Toolbox` card and `docs/design/light.png` / `dark.png`, in both themes
- [x] Existing Toolbox behavior, hotkeys and tests are unchanged

**Done (ticket 75):** two parts wait for their own tickets. The Custom color and Image colors pickers keep their current look and behavior until ticket 151 turns them into the card's Custom and Image colors buttons with their popovers. Save and the three exports stay in the Edit group, as a second row of the same 38px buttons, until ticket 148 moves them to the save box. Mirror's opened controls use −/+ buttons and an icon toggle for Copy mode until the Stepper and Switch cards are built (ticket 149's form controls).
