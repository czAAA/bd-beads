# MenuPanel

The body of the Menu: what is about the app and the device. It renders as a dropdown under its strip button on every screen size (ADR 0046). The Project body is the ProjectPanel card; the Frame panel is in the Frame card. All three open in the same shell, one at a time, close the same way and are built from the same four parts (below), so they look and space alike. (Spec 0440, tickets 0443, 0475; redesigned in ticket 0553, design canvas https://claude.ai/artifact/DtuwrYB8pNEabwFCYCC8wB.)

## Panel (the dropdown)

- Opens 4px under the Menu button on the Canvas strip, left edges aligned. `panel-width` (520px, 585px at the app's 18px root) wide, `radius-lg`, `overlay-fill` with a 1px `overlay-line` edge (2px `line-strong` in high contrast), `elevation-3`, padding 8, `z-popover`. Taller than the box: it scrolls inside, with no visible scrollbar.
- Closes on Escape, a press outside it (the press only closes), or the lit Menu button. Focus returns to the button.
- Motion: `duration-base` in, 150ms out, opacity and a 4px move; a fade only under reduced motion (as the Menu card).

## Density (ticket 0553)

About half the air of v18: every row is `panel-row` (28px; `panel-row-touch`, 36px, on a coarse pointer), padding 0 10, a 16px icon and an 8px gap. Sections are split by a 1px `line-soft` rule with 4px above and below it. The whole Menu, all sections open, is about 440px tall (was about 660). The 36px touch row is a deliberate exception to `touch-target` (responsive.md).

## The four shared parts

- **PanelSection:** a collapsible section. Its header is one `panel-row` button: the label in `label` style (DM Mono, lowercase) and a 14px chevron at the right (down when open, right when closed), `aria-expanded`. A collapsed section can show a short summary in `meta` before the chevron (Project and Frame use this: "Miyuki Delica 11/0 · real", "24 × 30 · ≈ 38 × 39 mm"). Open or closed is remembered on the device, per panel and section; on a first visit every section is open.
- **PanelItem:** a row: icon, label (`control`), an optional value at the right in `meta`, and an optional trailing 14px mark in `muted`: `chevron-right` (drawn as `chevron-left` turned) when it opens a subpanel, `external` when it leaves the app. `accent` text for the panel's main action, `danger` for a destructive one. Hover `hover-fill`, pressed `press-fill`, the 2px focus ring 2px away. A disabled item keeps its Tooltip with the reason and shows `faint` text.
- **PanelPicker:** a setting shown as its current value: icon and label on the left, a small button on the right (`picker-height`, 24px; 32 on touch; padding 0 6 0 8, `radius-sm`, `button` fill, 1px `button-line`) holding an optional 14px icon, the value word (`pill` type) and a 12px chevron. It opens a menu under it, right-aligned, 184px wide, items `panel-row` tall with a check on the chosen one; the button's edge turns `ink` while it is open. It replaces SettingChoice and the stacked SegmentedControls: every preference with three or more choices, and Input and Writing hand, is a PanelPicker. A two-choice toggle that changes how something looks (Bead shape) stays a small SegmentedControl on the row.
- **PanelListRow:** a two-line row, `panel-row-two-line` (40px; 48 on touch), padding 0 6: a 28px thumbnail (`radius-sm`, on `board`), the name (`control`, one line, ellipsis) over a second line in `small` / `muted`, then 14px facts in `muted` at the right. Used by the Projects library.

## Sections, in this order

1. **Projects:** New Project (`accent`, `plus`, ›) and **Projects library** (`library`, the count as its value, ›). Both push a subpanel. Import, Export all and Delete all moved into the library.
2. **Preferences:** Language (the code, "EN"), Theme (its icon and word: System, Light, Dark, High contrast), Tools position (its icon and word: Left, Top, Right, Bottom), Input (Pen, Mouse) and Writing hand (Right, Left), all PanelPickers. Input and Writing hand show only once a pen has been seen (ticket 326), absent otherwise, not disabled.
3. **Help:** Keyboard shortcuts (the key `?` as its value; only when a keyboard is attached), Homepage.
4. **About:** Source code (`external`; opens the repository in a new tab; the AGPL-3.0 network clause needs a hosted copy to link to its source, ticket 269), **Buy me a coffee** (the `coffee` icon in `accent-strong`, `external`; a deliberate second accent mark in the panel; the row is absent while the app has no link for it), and Version (a non-interactive row, indented to the label column, the number in `meta`).

On the Homepage (ticket 540) the panel leaves out Projects and the editor-only pickers, and shows its Homepage item as the current page.

## Projects library (subpanel)

Pushed by the Projects library row, under the header "Projects library" (Back icon button, the title in `title`, the count in `meta` at the right).

- **Import a project** (`import`, value `.openbeads`) and **Export all projects** (`export`, value `.openbeads`) as PanelItems, then a `line-soft` rule.
- The list, newest first, one PanelListRow per project: the thumbnail (the whole project, as SavedPatterns drew it), the name, the maker's name on the second line (absent when none, the name then centred), and at the right the Pieces count (`piece` icon and the number in `meta-small`), the `frame` icon when the project has a Frame (an empty 14px slot when not, so columns line up), and a 20px × Remove shown on hover or keyboard focus. The open project's thumbnail is ringed in `accent` and its name is `accent-strong`. A press opens the project and closes the panel. Hovering the facts shows a Tooltip: "3 pieces", the named Pieces ("Petal · Stem · 1 unnamed"), and "Frame 24 × 30 beads" when framed.
- **Delete all projects** (`danger`) in the pinned footer (1px `panel-rule` above). Its confirmation is unchanged ("Delete all Projects?" …).
- Empty: Export all projects and Delete all projects are disabled with their Tooltips, and the list's place says "No projects yet" over "Projects you make are kept on this device. Import a .openbeads file to bring one in."
- × Remove asks the existing single-project confirmation.

## Subpanel (spec 0478)

A panel can push **subpanels** over its root, as a stack (ticket 0493): New Project's Pick a starter pushes the Starter gallery's categories, a category its options, and an option its setup (StarterGallery card, ticket 0595), each under its own name; Back and Escape pop one level, and focus returns to the card that opened it. The header is a `chevron-left` Back icon button (plain, 8px gap) and the subpanel's title in `title`, 8px above the body. Back returns to the list and puts focus on the row it came from; Escape does the same, and closes the panel when the subpanel was the opening view (an empty library, or the empty-canvas bar's New Project button). Focus enters on the first field. The dropdown keeps `panel-width`; the header stays pinned while the body scrolls. A panel's `footer` slot (a pinned row, a 1px `panel-rule` above, padding 4 8 8) holds the library's Delete all projects and the Starter setup's Create Project. Closing the panel, or swapping to another, resets to the root and drops a draft. The panel is a `dialog` while a subpanel shows.

Nothing repeats a tool: Rulers, Undo, Redo and zoom live on the Canvas strip, Mirror in the pill and its sheet.

## Keyboard and screen readers

- The strip button is "Menu" / «Меню», `aria-haspopup="menu"`, `aria-expanded`. Enter, Space or Down opens on the first item, Up on the last. Arrows, Home and End move; Enter chooses; Escape or Tab closes.
- The dropdown is `role="menu"` named "Menu" (Project and Frame hold fields, so they are plain `dialog`s); items are `menuitem`; rules are `separator`; a section header is a button with `aria-expanded` and the section a `group` named by it. A PanelPicker is a button with `aria-haspopup="menu"`, named "{label}: {value}"; its menu items are `menuitemradio`. Escape in an open picker closes the picker only.
- A Version row is read as text.

## Copy

English: Projects, New Project, Projects library, Import a project, Export all projects, Delete all projects, No projects yet, Preferences, Language, Theme, Tools position, Input, Pen, Mouse, Writing hand, Help, Keyboard shortcuts, Homepage, About, Source code, Buy me a coffee, Version. Russian is in `writing.md` (Panels redesign).

Hand-written from spec 0440, the Menu and Project mockups and the ticket 0553 canvas; static rendition.
