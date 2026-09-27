# 142: Header restyle

**What to build:** The header matches the `Header`, `Button` and `BeadPill` cards, in order: the X1 mark and "bd-beads", "currently editing" with the Pattern summary and the Bead pill (only while a Pattern is open), the Replace bead select filled with the accent, a flexible gap, Import a file and Import QR code as text buttons with their results and errors beside them, New Pattern as the primary button, the EN / RU button, the theme toggle, and the round Keyboard shortcuts button. Two primary buttons never sit next to each other.

**Blocked by:** 137, 138, 139, 141, 157

**Status:** done

**Design system v13:** the header fits by priority, not by breaking: when labels don't fit (Russian needs about 250px more at 1440px) the lowest-priority labels drop first, as `writing.md` ("Fitting longer text") describes. The component card(s) in `docs/design/system/components/` are the spec: Header, BeadPill, ThemeToggle.

- [x] Header is 64px on `--canvas` with a 1px `--line-soft` bottom border and 10px between items, none shrinking
- [x] Buttons, select, pill and language button follow the variants in the `Button`, `BeadPill` and `Header` cards, including hover, pressed, disabled and the focus ring
- [x] Import results and errors show beside the button that caused them as a compact one-line message
- [x] Every icon this ticket touches comes from the shared Icon component (ticket 137), not an inline drawing
- [x] No hardcoded colors, fonts, sizes or shadows: only the role-named tokens from the design system's `tokens.json` (`DESIGN.md` §3)
- [x] Correct in both the light and the dark theme
- [x] Matches `docs/design/light.png` and `dark.png` for what they show, and `DESIGN.md` for the rest
- [x] All existing header behavior is unchanged (Replace bead confirmation, importing, language switch, shortcuts)
- [x] In Russian at 1440px the header fits on one line by dropping labels in the documented order, with names kept as tooltips
