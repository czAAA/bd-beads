# 148: Save box and Export menu

**What to build:** A save box of its own, second in the left column (the `SaveBox` and `Menu` cards): the "saved · this device" state (a check in `--accent`, or a `--danger` warning when a save fails, following ADR 0012), a full-width primary **Save Pattern**, and an **Export ▾** button that opens a menu with QR code, PNG image and PDF for printing, plus a "qr · png · pdf" hint. Save and Export leave the Toolbox. The QR code item opens the QR export panel.

**Blocked by:** 76, 141, 157

**Status:** done

**Design system v13:** The component card(s) in `docs/design/system/components/` are the spec: SaveBox, SaveStates, Menu. The Export menu ends with the Name on exports row, which ticket 161 adds.

- [x] Save Pattern and Export behave exactly as they did in the Toolbox (same shortcuts, same results); the Toolbox no longer has Save or Export
- [x] The save state text and icon follow the Pattern library's save state, and show the failure state when a save fails
- [x] The Export menu uses the shared menu from ticket 76: anchored under its button, 4px gap, 34px items with icon and label, keyboard navigable, Escape closes it
- [x] Buttons are 38px, 8px apart; the box is elevation 1 in light
- [x] Every icon this ticket touches comes from the shared Icon component (ticket 137), not an inline drawing
- [x] No hardcoded colors, fonts, sizes or shadows: only the role-named tokens from the design system's `tokens.json` (`DESIGN.md` §3)
- [x] Correct in both the light and the dark theme
- [x] Matches `docs/design/light.png` and `dark.png` for what they show, and `DESIGN.md` for the rest

**Done (ticket 148):** SaveBox sits second in the left column while a Pattern is open (not while framing), so it is also second in the tab order after the Toolbox. Its label follows the library's saveFailed. Export ▾ is the first AppMenu; QR code, PNG image and PDF for printing are menu items keeping the old test ids, and a Pattern too large for a QR code turns its item off with the reason written under it (a disabled control shows no tooltip, forms-and-states.md) instead of on a hover title. The menu has a `menu-footer` slot waiting for ticket 161's name on exports row. The Toolbox's Edit group is back to one row: Undo, Redo, Rotate, Copy.
