# 144: Progress bar: always shown, with the Row progress switch

**What to build:** The Progress bar is rebuilt as the `ProgressBar` card describes and sits along the canvas box's bottom edge, **always visible**: a "Show row progress" switch, the readout ("Row 12" and "of 30 · Top to bottom"), a progress track with its fill, Turn row direction, **Row not done** (formerly Previous row) and **Row done**. While Row progress is off, only the switch and a "row progress" label show and the bar keeps its height so the canvas doesn't jump. This replaces ticket 124's Pattern-shape placement (a side column for tall Patterns, a row for wide ones), and the Toolbox's Row progress group is removed.

**Blocked by:** 143

**Status:** done

**Design system v13:** The component card(s) in `docs/design/system/components/` are the spec: ProgressBar, SwitchAndFileButton.

- [x] The bar is 56px with the layout, spacing and controls in the `ProgressBar` card, in every Pattern shape; the shape-based placement and its helper are removed
- [x] The switch is `role="switch"` named "Show row progress" and turns Row progress on and off, replacing the Toolbox Enabled toggle; direction moves here too
- [x] Row done and Row not done move the current row exactly as Next and Previous do today, disabled at either end; "Row not done" and "Row done" are the strings in EN and RU
- [x] The track shows the finished share (gradient in light, `--accent`-family yellow in dark, via the design system's `--track-fill`)
- [x] The Toolbox no longer has a Row progress group
- [x] Hotkeys P, D, Enter and Shift+Enter keep working unchanged, and the current-row outline on the grid is unaffected
- [x] Every icon this ticket touches comes from the shared Icon component (ticket 137), not an inline drawing
- [x] No hardcoded colors, fonts, sizes or shadows: only the role-named tokens from the design system's `tokens.json` (`DESIGN.md` §3)
- [x] Correct in both the light and the dark theme
- [x] Matches `docs/design/light.png` and `dark.png` for what they show, and `DESIGN.md` for the rest
