# ShortcutsHelp

The Keyboard shortcuts modal: every shortcut, grouped as in the Toolbox.

- A Modal (560–640px), two columns of groups in the Toolbox's order; each group a `label` heading, each row the action in `body` and its keys as Kbd chips.
- Kbd: 22px, DM Mono 12, 1px `line-strong` with a 2px bottom edge, radius-xs, on `elevated`.
- "Previous row" is written "Back a row" here too (ticket 0972) (DESIGN.md §8). Shown only when a keyboard is present; opened by its header button or `?`.
- **Ticket 0796 adds Save Project file** (`Ctrl/Cmd+S`) **and Save Project file as…** (`Ctrl/Cmd+Shift+S`) to the Edit group (the dialog has no Project group), read from the control registry like every row.
- **v16 adds a Canvas group:** `6` Set Frame, `5` Hand, `R` Rulers, Space + drag or the wheel to move the canvas, ⌘ or Ctrl + wheel to zoom. Not drawn in the preview yet.
- Ticket 1007 removed Grid focus (`G`) from the Canvas group.
- **The Radial toolbox's row (ticket 1064):** the Canvas group has one row, "Tools at the pointer", with the chip `right-click`, written as the group's other gesture rows are. A hold on the Canvas with a finger or the Pencil joins it as a second chip, `hold` (ticket 1065). It repeats the Canvas hint, which screen readers do not hear (RadialToolbox card).

Hand-written from the Phase A sign-off (forms, screens and states); static rendition.
