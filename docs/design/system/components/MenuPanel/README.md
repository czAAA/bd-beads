# MenuPanel

The body of the Menu: what is about the app and the device. It renders as a dropdown under its strip button from 1024px and as the Top sheet below it, with the same sections and rows. The Project body is the ProjectPanel card; the shell under 1024px is the TopSheet card. (Spec 0440, ticket 0443.)

## Panel (the dropdown)

- Opens 4px under the Menu button on the Canvas strip, left edges aligned. `panel-width` (340px) wide, `radius-lg`, `overlay-fill` with a 1px `overlay-line` edge (2px `line-strong` in high contrast), `elevation-3`, padding 8, `z-popover`. Taller than the box: it scrolls inside, with no visible scrollbar.
- Closes on Escape, a press outside it (the press only closes), or the lit Menu button. Focus returns to the button.
- Motion: `duration-base` in, 150ms out, opacity and a 4px move; a fade only under reduced motion (as the Menu card).

## Sections, in this order

Each is a `role="group"` named by its label. Sections are split by a 1px `line-soft` rule and 8px of air above and 6px below. The section label is the `label` style (DM Mono, lowercase by style), padding 4 12 6.

1. **Projects:** New Project, Import, Export all (value `.openbeads`), Saved Projects (value: how many), Delete all. Delete all is last and `danger`. Nothing is accented: New Project is not a primary button here.
2. **Preferences:** Language, Theme, Tools position, Input.
3. **Help:** Keyboard shortcuts (the key `?` as its value; only when a keyboard is attached), Overview.
4. **About:** Source code (the external-link icon at the right; opens the repository in a new tab; the AGPL-3.0 network clause needs a hosted copy to link to its source, ticket 269) and Version (a non-interactive row, the number in `meta`).

There is no Tour item (the Tour is off, `TOUR_ENABLED`). Nothing repeats a tool: Rulers, Undo, Redo and zoom live on the Canvas strip, Mirror in the pill and its sheet.

## Items

- 34px (`item-height`), 44px in the Top sheet and on a coarse pointer, padding 0 12, `radius-sm`, 16px icon, 10px gap, label, then an optional value at the right in `meta`. Hover and keyboard focus use `hover-fill`; pressed `press-fill`. Keyboard focus is also the 2px `focus-ring`, 2px away.
- `danger` text and icon for Delete all.
- A disabled item keeps its Tooltip with the disabled reason and shows `faint` text.

## Setting rows

A preference that is always visible as its choices, in a SegmentedControl (small, 30px).

- **Two choices sit on the row:** icon, label, the control at the right. Language (EN | RU) and Input (Pen | Mouse).
- **Three or more stack under their label,** the control taking the full width, 8px below the label. Theme (four icon-only segments: Light, Dark, System, High contrast; each has an accessible name) and Tools position (Left | Top | Right | Bottom).
- The selected segment sits on `elevated` with a `line-strong` edge; in high contrast it is the `ink` fill with white text. Not `accent`: the one accent is for the next action.
- **Input** shows only once a pen has been seen (ticket 326), and is absent otherwise, not disabled. Pen draws with the tip and pans with touch; Mouse treats the pen as a mouse. It replaces the pill's Pen/Mouse toggle.
- **Tools position** replaces the Menu sheet's "Tools position" row and is the keyboard route to the pill's four edges (ToolPill card). It follows the device, like Theme.
- **In the Top sheet** these become choice lists, one option per line: a group heading (icon + name, Inter 600), then one 48px item per choice indented 42px, the current one in 600 weight with a 18px check at the right (`accent-strong`; `ink` in high contrast), `role="radiogroup"` with `role="radio"` and `aria-checked`. A segmented control of four does not fit a phone's width.

## Keyboard and screen readers

- The strip button is "Menu" / «Меню», `aria-haspopup="menu"`, `aria-expanded`. Enter, Space or Down opens on the first item, Up on the last. Arrows, Home and End move; Enter chooses; Escape or Tab closes.
- The dropdown is `role="menu"` named "Menu"; items are `menuitem`; rules are `separator`. The segmented rows are inside the menu as `role="group"` with the setting's name, the rest of the panel's keys unchanged. Under 1024px the sheet is a modal dialog (TopSheet card).
- Each section is named by its label; a Version row is read as text.

## Copy

English: Projects, New Project, Import, Export all, Saved Projects, Delete all, Preferences, Language, Theme, Tools position, Input, Pen, Mouse, Help, Keyboard shortcuts, Overview, About, Source code, Version. Russian is in `writing.md` (Menu and Project).

Hand-written from spec 0440 and the Menu and Project mockups; static rendition.
