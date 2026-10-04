# 280: Token and icon hygiene

**What to build:** Clean up the values the app hard-codes where the design system has a token or an icon. From the audit: `FrameControls.vue:208` `z-index: 10` (the value of `--z-canvas-overlay`); `--framing-dim` in `controls.css:61` is in no token file; `AppMenu.vue:244` has a 288px width and a 10px radius; `FrameControls.vue` and `SaveBox.vue` set font sizes in px; `useZoomFloor.ts` reads only `--bead-min-phone` and `--bead-min-tablet`, so the other three `--bead-min-*` tokens are dead; the `delete`, `more` and `pattern` icons are never used; the chevron in `ToolGroup.vue` and the info glyph in `FrameControls.vue` bypass `AppIcon`; `NewProjectForm.vue` has the id typo `heihgt-input` so its label is not tied to the field; DESIGN.md says "51 icons" where the repo has 52. Skip renaming `--type-*` to `--text-*` and the type classes: it is a naming difference only, so note it in DESIGN.md §4.6. Source: the audit of design system v18 against the app (2026-10-04).

**Blocked by:** 273

**Human involvement:** autonomous

**Status:** ready-for-agent

- [ ] Each stray value above uses a token (adding one to `tokens.json` and `tokens.css` where there is none, with a `usage` line), or is documented in DESIGN.md as deliberate (local stacking, the QR code's black and white)
- [ ] `useZoomFloor` reads the `--bead-min-*` token for the current screen tier, with a test for each tier
- [ ] The two inline icons use `AppIcon`; `delete`, `more` and `pattern` are either used where the cards place them (`pattern` is the Dock's Pattern button) or the cards and DESIGN.md say they are reserved
- [ ] The Height field's id and label match; DESIGN.md's icon count is right; DESIGN.md §4.6 notes that `--type-*` and `--text-*` are the same styles under different names
- [ ] Related tests pass; no visual reference changes except where a value was wrong; the README Version changelog has a line
