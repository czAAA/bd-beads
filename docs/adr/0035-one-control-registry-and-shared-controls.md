# One control registry and a few shared controls

**Status: accepted.** Tickets 327–341; the migration runs one surface at a time.

The same control (Paint, Undo, Copy, Rotate, Set Frame…) was written by hand in the Toolbox, the phone sheets, the Dock, the ContextBar and the Zoom pill, and the copies drifted: a Tooltip with a key chip in one place, a bare name in another, a native `title` in a third. Key chips and the Keyboard shortcuts dialog were written apart from the keyboard handler, so they could lie.

- **One control registry** (`composables/shell/controlRegistry.ts`) defines every action once: id, icon, name, Tooltip body, key(s), whether it is enabled and, if it can be disabled, why (`disabledBody`), and what it runs. Every surface, the Keyboard shortcuts dialog included, renders from it.
- **The registry runs the keyboard.** The shortcut table is built from its keys, so a key chip always matches what the key does. A unit test fails if two actions declare the same key. One action may have several keys (Row done: `Enter`, `Space`); several controls may show one action (Done, Cancel and Clear selection all show `Escape`, the one Back out action).
- **One component per kind of control, not per place**: `IconButton` (icon-only), `AppButton` (label with an optional icon), `MenuButton` (opens a popover or a sheet), `AppSwatch` (one color chip), all wired to `AppTooltip`. Text that must always be readable is an `AppNote`.
- **Tooltip rules**: a name always, a body and a key chip optional; a control shows a Tooltip exactly when one is given. A control that can be disabled gives a `disabledBody`, shown in place of the body, with no key chip, and uses `aria-disabled` so it stays hoverable and focusable. No native `title`, no hand-built popups. A Tooltip is help, never the only way to a control ([ADR 0001](0001-local-only-persistence.md)).

**Considered options**: shared components with labels and keys still set per place (rejected: the drift came from the duplicated settings, not only the markup); the registry feeding labels only (rejected: every key written twice); scoped keys, the same key reused in different modes (rejected for now: one key, one action is simpler to check).

**Consequences.** Adding a control starts with a registry entry; a one-off control has to justify itself. A key change is one edit, guarded by the duplicate-key test.
