# 383: Every screen uses the Dock layout, with the Toolbox layout kept behind a flag

**What to build:** the layout people know from a phone or an iPad held upright (canvas first, a Dock below it, sheets for the controls) becomes the layout for everyone, at every width. Today a window 1024px or wider gets the header, the left column and the Toolbox ([ADR 0032](../docs/adr/0032-everything-under-1024px-is-the-phone-layout.md)). That wide layout is not deleted: one flag in `src/features.ts` switches between the two, so the owner can compare them and go back at no cost. The two layouts get new names: **Dock layout** (the new default) and **Toolbox layout** (today's wide one). "Phone layout" and "desktop layout" stop making sense once the first runs on a desktop.

**Spec:** this ticket is the spec; it is to be implemented as one ticket, in two or three commits (flag, shared controls, docs).

**Blocked by:** None (can start immediately)

**Status:** ready-for-agent

## Problem Statement

The person who owns the app wants the touch layout to be the main experience for every user, not only for those on a phone or an iPad. They do not want to throw the Toolbox layout away yet, and they want to switch between the two without a rewrite. Today the layout is chosen by one width split (1024px) scattered over about 33 CSS media-query sites and a few width checks in script, and the Toolbox layout's controls are built separately from the Dock sheets' controls, so a control changed in one is easily forgotten in the other.

## Solution

A build-time flag, `DOCK_LAYOUT_ENABLED`, in the switched-off-features file ([ADR 0041](../docs/adr/0041-switched-off-features-live-in-features-ts.md)). On (the new default), the editor shell is the Dock layout at every width: the canvas fills the screen, the Dock sits below it at its usual width, the Project, Colour, Tool, Frame and Menu controls open as sheets, and the slim Canvas strip is always visible. Off, the app behaves exactly as it does today, including the 1024px split. The Dock sheets and the Toolbox use the same controls, so a control is changed in one place.

## User Stories

1. As a person on a laptop, I want the app to open with the canvas first and a Dock below it, so that I get the same calm layout I get on my phone.
2. As a person on a desktop monitor, I want the canvas to use all the room around the Dock, so that a big screen means a bigger working area, not a stretched toolbar.
3. As a person on a phone held upright, I want nothing to change, so that my habits keep working.
4. As a person on an iPad in either orientation, I want the same Dock layout I have now, so that the change does not touch me.
5. As a person using a mouse, I want the Dock and its sheets to work with click, hover and keyboard, so that I am not forced to use touch.
6. As a person using the keyboard, I want every shortcut to keep working in the Dock layout, so that I can paint, undo, switch tools and zoom without the pointer.
7. As a person drawing, I want Undo, Redo, zoom and the Rulers switch in the Zoom pill, so that I find them in one place on every screen.
8. As a person with a Project open, I want the slim Canvas strip visible in every width and orientation, so that I always see what the canvas is and can change its color.
9. As a person with a Project open, I want the strip to show the title, the size line and the keyboard hint, so that I know what I am working on and what the arrows and space do.
10. As a person changing the Canvas color, I want the picker in the strip and not also in the Project sheet header, so that there is one place to look.
11. As a person who uses high contrast, I want the strip's picker to open the Position marks choice alone, as it does now.
12. As a person with no Project open, I want the New Project / Import bar where the Dock would be, so that I can start straight away.
13. As a person on a phone held on its side, I want the strip to stay a single slim row, so that most of the short screen is still canvas.
14. As a person who opens the Menu, I want the language, theme, Name on exports, Keyboard shortcuts, Overview and source link there, so that the header's items are not lost.
15. As a person who opens the Overview, I want it to look as it does now, so that the front door is unchanged.
16. As a person who relies on a pen, I want Pen mode to work as today, so that a palm resting on the screen still does not paint.
17. As a person who uses a screen reader, I want the Dock buttons to keep their accessible names, so that icon-only buttons stay usable.
18. As the app's owner, I want one flag that restores the Toolbox layout, so that I can switch back for comparison or a bad release.
19. As the app's owner, I want flag off to behave exactly as today, so that going back costs nothing.
20. As the app's owner, I want the flag next to the other switched-off features, so that I find it where I look for them.
21. As a developer, I want the Toolbox and the Dock sheets to use the same tool, colour and edit controls, so that I change a control once.
22. As a developer, I want only the Toolbox itself marked as an exception for the unused-code check, so that dead code elsewhere is still caught.
23. As a developer, I want tests to run under both flag values, so that the Toolbox layout does not rot while it is switched off.
24. As the app's owner, I want the decision written down, so that a later reader knows why a desktop shows the touch layout.
25. As the app's owner, I want the glossary to use "Dock layout" and "Toolbox layout", so that the words in the code, tickets and docs agree.

## Implementation Decisions

- **Flag.** A build-time constant `DOCK_LAYOUT_ENABLED`, default on, in the file that holds the switched-off features ([ADR 0041](../docs/adr/0041-switched-off-features-live-in-features-ts.md)). It reads inverted compared with the other flags (on is the new normal); its comment says so and says that off restores the 1024px split. A `?layout=toolbox` URL override for development is added only if it is cheap; it is not required.
- **One place decides the layout.** Today the 1024px split is repeated in many media queries and in script. The shell gets a single source of "which layout" and the places that branch on width read it. With the flag on the shell is always the Dock layout; with it off the existing width rules apply unchanged. Because a media query cannot read a constant, the shell carries a layout class on its root and the layout CSS keys on it; the existing width rules stay for the flag-off case.
- **Dock layout at wide widths.** The Dock keeps its ~480px width, centred; the canvas takes the rest of the width. No header, no left column, no Toolbox.
- **Canvas strip.** Visible in the Dock layout at every width and orientation, one row at its existing height. It shows the title, the size line, the hint and the Canvas color picker. The zoom buttons and the Rulers toggle are not repeated in it, because the Zoom pill owns them there. The Toolbox layout's strip is unchanged.
- **Canvas color picker.** In the Dock layout it leaves the Project sheet header; in the Toolbox layout nothing changes.
- **Nothing moves into the Menu.** The Menu keeps what it holds today.
- **Overview.** Untouched; the flag covers only the editor shell (header, left column, Toolbox, canvas strip).
- **Shared controls.** The tool buttons, the colour controls (palette, custom colour, Image colours) and the Edit controls (Undo, Redo, Rotate, Copy and so on) become shared components used by both the Toolbox and the Dock sheets. The sheets' arrangement does not change. If this refactor turns out bigger than the flag, it is split into its own ticket that lands first.
- **Unused-code check.** The Toolbox, and what only it uses, is marked as an exception; shared components are used by the sheets and need none.
- **Decision record.** A new ADR, "The Dock layout is the main layout; the Toolbox layout is kept behind a flag", amends ADR 0032: it records the trade-offs (a touch layout on large screens against a hard-to-reverse loss of the Toolbox's directness; a runtime switch rejected because every media query would need a script-driven class; the strip's height cost on short landscape screens accepted).
- **Glossary and docs.** "Dock layout" and "Toolbox layout" are added to the glossary; "phone layout" and "desktop layout" are retired from `CONTEXT.md`, `docs/glossary/` and `docs/layout.md`. `CONTEXT.md` is in a conflicted merge state on the branch where this was specced: resolve that first, or edit after it lands.
- **Ticket archived in the same change.**

## Testing Decisions

- A good test here looks at what the person sees and does (which landmarks are on screen, which control opens which sheet), not at class names or at which component rendered it.
- **Seams (to confirm with the owner).** One new seam, the highest that exists: the App shell mounted at a wide width and at a narrow width, once with the flag on and once off. Existing seams are reused for the rest: components on their own (the shared controls, the Canvas strip), the control registry test (no duplicate keys), and the breakpoint tests that read the CSS back out.
- Unit tests run under both flag values: flag on at a wide width shows the Dock, the strip and no Toolbox or header; flag off at the same width shows the Toolbox layout as before; flag off under 1024px is unchanged.
- The Canvas strip: shows title, size line, hint and picker and no zoom buttons or Rulers toggle in the Dock layout; unchanged in the Toolbox layout; the picker is no longer in the Project sheet header when the flag is on.
- E2E and visual checks cover the Dock layout only; the Toolbox layout's e2e is skipped while the flag is on. Visual references that change are updated in the same pull request and the pull request says so (`docs/testing.md`).
- Prior art: `src/App.responsive.test.ts` and `src/testUtils/fakeMatchMedia.ts` for width-dependent shell tests, `src/components/ui/MenuButton.test.ts` and `src/components/canvas/ProgressBar.test.ts` for components on their own, `src/composables/shell/controlRegistry.test.ts` for the registry.

## Out of Scope

- Reorganising where controls live in the Dock, the sheets or the Menu; the owner will do that in a separate design session.
- Deleting the Toolbox, the header, the left column or their tests.
- A runtime or user-facing layout switch.
- Changes to the Overview page.
- New controls, new tools or new Dock slots.
- Hiding the strip on short landscape screens.

## Further Notes

- The Dock sheets already cover nearly every Toolbox control; the one odd placement found was the Canvas color picker in the Project sheet header.
- The rationale for the 1024px split, and its landscape-phone bug, is in [ADR 0032](../docs/adr/0032-everything-under-1024px-is-the-phone-layout.md); the strip is the part of that decision this ticket reverses for the Dock layout.

## Checklist

- [ ] `DOCK_LAYOUT_ENABLED` in `src/features.ts`, default on, commented
- [ ] Flag on: Dock layout at every width; flag off: today's behaviour exactly
- [ ] Canvas strip visible in the Dock layout (title, size line, hint, Canvas color picker)
- [ ] Canvas color picker out of the Project sheet header in the Dock layout
- [ ] Tool, colour and Edit controls shared by the Toolbox and the Dock sheets
- [ ] Only the Toolbox marked as an exception for the unused-code check
- [ ] Unit tests under both flag values; e2e and visual for the Dock layout
- [ ] New ADR; ADR 0032 marked as amended
- [ ] Glossary, `CONTEXT.md` and `docs/layout.md` use "Dock layout" and "Toolbox layout"
- [ ] The ticket is archived in the same change
