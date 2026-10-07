# 329: Control registry that also runs the keyboard, with a duplicate-key test

**What to build:** One registry that defines every action once (ADR 0035): id, icon, name, Tooltip body, key(s), `enabled` with `disabledBody` for any action that can be disabled, and what it runs. Build `useAppShortcutTable` from the registry's keys so that pressing a key runs the same action the button runs. Generate the Keyboard shortcuts dialog from the registry. Add a unit test that fails if two actions declare the same key or combination. One action may have several keys, and several controls may show the same action: `Escape` is one Back out action, shown on Done, Cancel and Clear selection.

Key changes in this ticket:
- `Del` only empties the Selection's beads. It no longer picks the Eraser.
- `Shift+Del` runs Remove row/column.
- `Shift+R` runs Rotate.
- Clear has no key.
- `P` is the single Row progress action. The Zoom pill's button becomes the same action in ticket 338.

CONTEXT.md (Eraser, Remove row/column, Rotate) is already updated.

**Spec:** 343 (unified controls spec)

**Blocked by:** None (can start immediately).

**Status:** needs-triage

- [ ] Every action that has a key is defined once in the registry, and the shortcut table is built from it
- [ ] A unit test fails on a duplicate key or combination
- [ ] The Keyboard shortcuts dialog lists what the registry lists
- [ ] `Del`, `Shift+Del` and `Shift+R` behave as above, with tests; `Del` without a Selection does nothing
- [ ] The existing key behavior (1–6, R, P, D, Enter/Space, Ctrl/Cmd+Z/C/V/S, ?, Escape, Shift+palette keys) is unchanged and still tested
