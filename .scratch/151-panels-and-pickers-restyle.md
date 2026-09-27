# 151: Panels and pickers: QR export, Keyboard shortcuts, Custom color, Image colors

**What to build:** The QR export panel, the Keyboard shortcuts help, the Custom color picker and the Image colors picker all use the modal or popup template from ticket 76 (the `Modal` and `Menu` cards): centered or anchored, the right fill per theme, the scrim, focus trapped while open and returned to the opener, Escape and scrim to close. Their contents use the new tokens and controls.

**Blocked by:** 76, 149, 157

**Status:** done

**Design system v13:** The component card(s) in `docs/design/system/components/` are the spec: QrExport, ShortcutsHelp, ColorPickers. The Image colors picker is a popover (`z-popover`), not a modal.

- [x] Each of the four opens, closes and returns focus as it does today, now with the shared modal or popup behavior
- [x] Panels are 560px wide and confirms 420px, with title, body and right-aligned actions per the `Modal` and `Menu` cards
- [x] The `kbd` hints use meta-tiny and `--radius-xs`
- [x] Nothing in them uses the old tokens
- [x] Every icon this ticket touches comes from the shared Icon component (ticket 137), not an inline drawing
- [x] No hardcoded colors, fonts, sizes or shadows: only the role-named tokens from the design system's `tokens.json` (`DESIGN.md` §3)
- [x] Correct in both the light and the dark theme
- [x] Existing tests for all four pass

**Done (ticket 151):** Keyboard shortcuts is a 560px AppModal with two columns of groups, `label` headings and Kbd chips (22px, DM Mono, a 2px bottom edge, `radius-xs`), the keys also written out for screen readers. QR export is the QrExport card's narrow Modal (340px, which the card sets over the ticket's 560): the code on white, the Pattern's name and size, "Scan it with Import QR code on another device." and Close. Both are read rather than answered, so focus starts on the dialog (AppModal's `initialFocus: 'dialog'`) and Tab reaches Close, and focus returns to the opener. Custom color is the card's button (a 12px swatch, hatched until chosen, and the label; the ring while selected), still the unstyleable native picker. Image colors is a button with a popover on `z-popover` (a 7-column grid, the chosen one ringed; choosing, Escape or a press outside closes it); with no Image colors it is `faint` and its tooltip says why (new copy). The swatches stay in the DOM while the popover is closed, so every existing test of them still runs. The QR finder squares keep the scanner's square corners: rounding them is a risk to scanning that the card's look doesn't justify. The too-large state's Export Pattern way out is ticket 158's.
