# 152: Redesign audit and contract

**What to build:** Finish the redesign. Delete the ticket-02 tokens and every rule that used them, then check the whole app against `DESIGN.md`, the design system files and the approved screenshots, and fix or record whatever doesn't match. After this ticket the app follows `DESIGN.md` 100%: nothing of the old look remains.

**Blocked by:** 75, 76, 139, 140, 141, 142, 143, 144, 146, 147, 148, 149, 150, 151, 157, 158, 159, 160, 161, 162, 163, 164, 165

**Status:** ready-for-agent

**Design system v13:** the audit covers all three themes and the design system's accessibility rules as well as the screenshots.

- [ ] The old `--color-*`, `--border-width`, `--radius-md`/`-lg`/`-pill` tokens and Segoe UI stack are gone from the styles, and a search finds no hardcoded color, font, size or shadow outside the token definitions
- [ ] No Icons v1 drawing remains: every icon comes from the Icon component, and the header and favicon use the X1 mark
- [ ] The editor at 1440×900 in light and dark matches `docs/design/light.png` and `dark.png`; each difference is fixed or listed in this ticket with a reason
- [ ] Each Derived area (messages, modals, menus, hover and focus states, empty Row progress, New Pattern, Convert image) is looked at in both themes and any gap is added to `DESIGN.md`
- [ ] The design system folder `docs/design/system/` matches `DESIGN.md` and the shipped app (tokens, icons, logo); any drift is fixed on the side that is wrong
- [ ] Keyboard focus rings, tab order and contrast follow `DESIGN.md` §3.6 in both themes
- [ ] Every feature works as before: this is a restyle, not a behavior change; the full test suite, type check and lint pass
- [ ] ADR 0004 and ADR 0005 are marked as superseded where ADR 0021 replaces them
- [ ] Checked in light, dark and high contrast, and at 200% browser zoom (layout holds, the left column scrolls)
- [ ] Nothing below 11px (rulers and Saved Pattern sizes only)
- [ ] Every design system component card that applies to the desktop app has a matching, working component
