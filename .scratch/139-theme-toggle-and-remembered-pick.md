# 139: Theme toggle and remembered pick

**What to build:** A sun/moon toggle sits in the header (`DESIGN.md` §5.3). Pressing a theme sets it, the app ignores the device setting from then on, and the pick is remembered on this device the same way the language is. With no pick, the toggle shows the device's current theme as active.

**Blocked by:** 136, 137

**Status:** ready-for-agent

**Design system v13:** the theme control is four-way: Match device (the default), Light, Dark and High contrast, as a radio group. The component card(s) in `docs/design/system/components/` are the spec: ThemeToggle.

- [ ] The toggle matches §5.3: 34px frame, two 28px icon buttons, active one filled `--ink` with its icon in `--canvas`, the other `--subtle`; accessible names "Light theme" and "Dark theme" (EN and RU)
- [ ] Picking a theme changes the whole app at once with no flash, and reloading keeps it
- [ ] Before any pick the toggle follows the device live
- [ ] Placed in the current header until ticket 142 restyles it; Correct in both the light and the dark theme
- [ ] Tests cover pick, persistence, and the device-follow default
- [ ] Four options with the `device`, `sun`, `moon` and `contrast` icons; one tab stop, arrow keys move, `role="radiogroup"`, names "Match device", "Light theme", "Dark theme", "High contrast"
- [ ] Match device follows `prefers-color-scheme` and `prefers-contrast: more`; any other pick sticks on the device
