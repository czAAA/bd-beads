# 29: Mirror card — icon buttons with hover tooltips, sized no taller than Palette

**What to build:** The two "Mirror current" buttons in the Mirror ("Отражение") tool-strip card — currently long text buttons that wrap to two lines in Russian — become small icon buttons, using the same icon-button convention Undo and Rotate already use in the neighboring card. Hovering or keyboard-focusing an icon reveals the current button text ("Mirror current (horizontal)" / "Mirror current (vertical)") as a tooltip, via the same `title` + `aria-label` pairing Undo/Rotate already rely on — no new tooltip mechanism. The payoff: because `.tool-strip` stretches every card in a row to match the tallest one, shrinking Mirror's buttons stops it (and its neighbors) from being forced taller than the Palette card.

**Blocked by:** None (can start immediately)

**Status:** done

- [ ] The two mirror-current buttons render as icon buttons, not text buttons, in the Mirror card
- [ ] The horizontal and vertical icons are visually distinct from each other and from the Undo/Rotate icons, and read as "mirror across this axis"
- [ ] Hovering or keyboard-focusing either icon shows the existing English/Russian button text as a tooltip
- [ ] Screen readers still announce the same descriptive text via `aria-label` (unchanged from today's button text)
- [ ] The Mirror card's rendered height is no taller than the Palette card's rendered height, in both English and Russian, at the default window width
- [ ] Clicking the icon still performs the same mirror-current action as before — only presentation changes, not behavior
- [ ] Existing tests covering these buttons (`mirror-current-horizontal` / `mirror-current-vertical` testids) still pass unchanged
