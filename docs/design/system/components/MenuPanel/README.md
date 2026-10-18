# MenuPanel

The body of the Menu: what is about the app and the device. It renders as a dropdown under its strip button from 1024px and as the Top sheet below it, with the same sections and rows. The Project body is the ProjectPanel card; the shell under 1024px is the TopSheet card. The Frame bar (Frame card) opens in the same shell, so Menu, Project and Frame are one panel at a time and close the same way; it alone can also hang from a button on the canvas (the edit pencil), as a dropdown at every width. (Spec 0440, tickets 0443, 0475.)

## Panel (the dropdown)

- Opens 4px under the Menu button on the Canvas strip, left edges aligned. `panel-width` (340px) wide, `radius-lg`, `overlay-fill` with a 1px `overlay-line` edge (2px `line-strong` in high contrast), `elevation-3`, padding 8, `z-popover`. Taller than the box: it scrolls inside, with no visible scrollbar.
- Closes on Escape, a press outside it (the press only closes), or the lit Menu button. Focus returns to the button.
- Motion: `duration-base` in, 150ms out, opacity and a 4px move; a fade only under reduced motion (as the Menu card).

## Sections, in this order

Each is a `role="group"` named by its label. Sections are split by a 1px `line-soft` rule and 8px of air above and 6px below. The section label is the `label` style (DM Mono, lowercase by style), padding 4 12 6.

1. **Projects:** New Project, Import, Export all (value `.openbeads`), Saved Projects (value: how many), Delete all Projects. Delete all Projects is last and `danger`: it removes every Project from this device after a confirmation ("Delete all Projects?", "Every Project is removed from this device. This can't be undone. Export all first if you want to keep copies.", Cancel and a `danger`-filled "Delete all Projects") and leaves the empty state. It is disabled with no Project saved, its Tooltip saying so. Import keeps the panel open until its file is read, then the result is a toast and the panel closes. Nothing is accented: New Project is not a primary button here.
2. **Preferences:** Language, Theme, Tools position, Input.
3. **Help:** Keyboard shortcuts (the key `?` as its value; only when a keyboard is attached), Overview.
4. **About:** Source code (the external-link icon at the right; opens the repository in a new tab; the AGPL-3.0 network clause needs a hosted copy to link to its source, ticket 269) and Version (a non-interactive row, the number in `meta`).

There is no Tour item while the Tour is off (`TOUR_ENABLED`); turning it back on adds "Take the tour" after Overview in Help. Nothing repeats a tool: Rulers, Undo, Redo and zoom live on the Canvas strip, Mirror in the pill and its sheet.

## Items

- 34px (`item-height`), 44px in the Top sheet and on a coarse pointer, padding 0 12, `radius-sm`, 16px icon, 10px gap, label, then an optional value at the right in `meta`. Hover and keyboard focus use `hover-fill`; pressed `press-fill`. Keyboard focus is also the 2px `focus-ring`, 2px away.
- `danger` text and icon for Delete all.
- A disabled item keeps its Tooltip with the disabled reason and shows `faint` text.

## Setting rows

A preference that is always visible as its choices, in a SegmentedControl (small, 30px).

- **Two choices sit on the row:** icon, label, the control at the right. Input (Pen | Mouse). Language has seven choices, so on the dropdown it is the existing language button (its code, "EN", opening the list) on the row, and in the Top sheet it is the list, one language per line in its own name.
- **Three or more stack under their label,** the control taking the full width, 8px below the label. Theme (four icon-only segments: Light, Dark, System, High contrast; each has an accessible name; the one word is "System" in both places) and Tools position (Left | Top | Right | Bottom).
- The selected segment sits on `elevated` with a `line-strong` edge; in high contrast it is the `ink` fill with white text. Not `accent`: the one accent is for the next action.
- **Input** shows only once a pen has been seen (ticket 326), and is absent otherwise, not disabled. Pen draws with the tip and pans with touch; Mouse treats the pen as a mouse. It replaces the pill's Pen/Mouse toggle.
- **Tools position** replaces the Menu sheet's "Tools position" row and is the keyboard route to the pill's four edges (ToolPill card). It follows the device, like Theme.
- **In the Top sheet** these become choice lists, one option per line, folded until tapped: a header row (icon + name in Inter 600 and under it the current choice in `muted` meta type, indented to the name, with a 16px chevron at the right of that line, down, up when open; a button with `aria-expanded`) that opens the list, so the sheet stays short like the dropdown's one-line controls. Open, below the header, one 48px item per choice indented 42px (a 16px icon in the indent when the choice has one: `globe` for each language, `device`/`sun`/`moon`/`contrast` for Theme, `position-*` for Tools position, `pen-mode`/`pen-mode-off` for Input), the current one in 600 weight with a 18px check at the right (`accent-strong`; `ink` in high contrast), `role="radiogroup"` with `role="radio"` and `aria-checked`. A segmented control of four does not fit a phone's width.

## Keyboard and screen readers

- The strip button is "Menu" / «Меню», `aria-haspopup="menu"`, `aria-expanded`. Enter, Space or Down opens on the first item, Up on the last. Arrows, Home and End move; Enter chooses; Escape or Tab closes.
- The dropdown is `role="menu"` named "Menu" (the Project dropdown holds fields, so it is a plain `dialog`); items are `menuitem`; rules are `separator`. The segmented rows are inside the menu as `role="group"` with the setting's name, the rest of the panel's keys unchanged. Under 1024px the sheet is a modal dialog (TopSheet card).
- Each section is named by its label; a Version row is read as text.

## Copy

English: Projects, New Project, Import, Export all, Saved Projects, Delete all, Preferences, Language, Theme, Tools position, Input, Pen, Mouse, Help, Keyboard shortcuts, Overview, About, Source code, Version. Russian is in `writing.md` (Menu and Project).

Hand-written from spec 0440 and the Menu and Project mockups; static rendition.
