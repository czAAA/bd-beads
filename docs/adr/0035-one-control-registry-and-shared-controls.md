# One control registry and a few shared controls

**Status: accepted.** Tickets 327–341.

## Context

The same control is written by hand in several places: Paint, Undo, Copy, Rotate, Set Frame and Remove Frame each appear in the Toolbox, the phone sheets, the Dock, the ContextBar and the Zoom pill, each with its own markup, label, hover help and key. The audit of every button (tickets 327–341) found the copies had drifted: the same control has a Tooltip with a key chip in one place, a bare name in another, a native `title` in a third and nothing in a fourth. Key chips and the Keyboard shortcuts dialog are written separately from the keyboard handler, so they can drift too. Two hand-built (i) popups sit outside the Tooltip entirely. There are no users yet, so the controls can be redesigned freely.

## Decision

- **One control registry** defines every action once: id, icon, name, Tooltip body, key(s), whether it is enabled and, if it can be disabled, the reason (`disabledBody`), and what it runs. The Toolbox, phone sheets, Dock, ContextBar, Zoom pill, Progress bar, header and the Keyboard shortcuts dialog render controls from it.
- **The registry runs the keyboard.** The shortcut table is built from the registry's keys, so a key chip always matches what the key does. A unit test fails if two actions declare the same key or combination. One action may have several keys (Row done: `Enter`, `Space`). Several controls may show the same action (Done, Cancel and Clear selection all show `Escape`, the one Back out action).
- **One component per kind of control, not one per place:** `IconButton` (icon-only, absorbs ToolButton, ExpandButton, the Dock slots, sheet close and steppers), `AppButton` (label with an optional leading icon, absorbs AppLink), `MenuButton` (a button that opens a popover or sheet), `Swatch` (one color chip), all wired to `AppTooltip`. Helper text that must always be readable is a `Note`.
- **Tooltip rules:** a name always, a body and a key chip optional. A control shows a Tooltip exactly when one is given to it. A control that can be disabled must give a `disabledBody`, shown in place of the body with no key chip. Disabled controls use `aria-disabled` so they stay hoverable and focusable. Native `title` and the hand-built (i) popups are removed.

## Considered options

1. **Shared components only, labels and keys still set per place.** Rejected: the drift came from the duplicated settings, not just the duplicated markup.
2. **The registry feeds labels only, and the keyboard table stays separate.** Rejected: the same key would still be written twice, and the chips could lie.
3. **Scoped keys (the same key reused in different modes).** Rejected for now: strict one-key-one-action is simpler to check, and `Escape` already works as one action.

## Consequences

- Adding a control means adding a registry entry first. A place that needs a one-off control has to justify it.
- A key change is one edit, and the duplicate-key test guards it.
- The registry is a large shared module. Migrating to it touches every surface, so the migration tickets run one after another.
