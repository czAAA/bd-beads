# 151: Panels and pickers: QR export, Keyboard shortcuts, Custom color, Image colors

**What to build:** The QR export panel, the Keyboard shortcuts help, the Custom color picker and the Image colors picker all use the modal or popup template from ticket 76 (`DESIGN.md` §5.13): centered or anchored, the right fill per theme, the scrim, focus trapped while open and returned to the opener, Escape and scrim to close. Their contents use the new tokens and controls.

**Blocked by:** 76, 149, 157

**Status:** ready-for-agent

**Design system v13:** The component card(s) in `docs/design/system/components/` are the spec: QrExport, ShortcutsHelp, ColorPickers. The Image colors picker is a popover (`z-popover`), not a modal.

- [ ] Each of the four opens, closes and returns focus as it does today, now with the shared modal or popup behavior
- [ ] Panels are 560px wide and confirms 420px, with title, body and right-aligned actions per §5.13
- [ ] The `kbd` hints use meta-tiny and `--radius-xs`
- [ ] Nothing in them uses the old tokens
- [ ] Every icon this ticket touches comes from the shared Icon component (ticket 137), not an inline drawing
- [ ] No hardcoded colors, fonts, sizes or shadows: only the role-named tokens from `DESIGN.md` §3
- [ ] Correct in both the light and the dark theme
- [ ] Existing tests for all four pass
