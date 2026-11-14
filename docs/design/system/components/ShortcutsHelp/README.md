# ShortcutsHelp

The Keyboard shortcuts modal: every shortcut, grouped as in the Toolbox.

- A Modal (560–640px), two columns of groups in the Toolbox's order; each group a `label` heading, each row the action in `body` and its keys as Kbd chips.
- Kbd: 22px, DM Mono 12, 1px `line-strong` with a 2px bottom edge, radius-xs, on `elevated`.
- "Previous row" is written "Row not done" here too (DESIGN.md §8). Shown only when a keyboard is present; opened by its header button or `?`.
- **Ticket 0796 adds Save Project file** (`Ctrl/Cmd+S`) **and Save Project file as…** (`Ctrl/Cmd+Shift+S`) to the Edit group (the dialog has no Project group), read from the control registry like every row.
- **v16 adds a Canvas group:** `6` Set Frame, `5` Hand, `R` Rulers, Space + drag or the wheel to move the canvas, ⌘ or Ctrl + wheel to zoom. Not drawn in the preview yet.
- **Ticket 1002 adds Grid focus** (`G`) to the Canvas group, read from the control registry like every row (approved 2026-11-14, not yet in the app).

Hand-written from the Phase A sign-off (forms, screens and states); static rendition.
