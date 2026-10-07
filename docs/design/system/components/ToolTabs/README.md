# ToolTabs

The Tools group: six icon tabs (Paint, Fill, Select, Eraser, Hand, Frame) on a rule, with Remove Frame, Remove line and Clear underneath.

- **Tabs (ticket 292):** 56px wide, 72px tall, no tile background, five to a row (Frame wraps to a second row). Icon 34px, `muted`, centered in the tab; no text label. Each row has a full-width 1px `line-strong` rule under it.
- **Active:** the icon and key turn `accent-strong` (`accent` yellow in dark) and a 2px accent underline sits over the rule (3px in high contrast; `Highlight` in forced colors). It replaces v18's inset outline (this is v16's tab look again, on icons).
- **Hotkey:** each tab prints its key against the icon's top-right corner: 1 Paint, 2 Fill, 3 Select, 4 Eraser, 5 Hand, 6 Frame (7 to `=` are left free for later tools; E, H and F are no longer shortcuts). DM Mono 11px, `muted`, accent when active, absolutely positioned so it never moves the icon (`bb-tool-key`, `aria-hidden`). It is also in the tooltip ("Paint (1)") and in `aria-keyshortcuts`, and it shows on every device. Each tab is named by its tool ("Paint"), not by the key. Shift+digit still picks the Palette.
- **Width:** five 56px tabs need the MacBook-tier left column at 366px (`column-width`, was 326px).
- 12px below the tabs: **Remove Frame** (link, `close` icon, left). It removes the Frame and is disabled while there is none.
- 10px below: **Remove line** (link, left, `faint` while there is no line to remove) and **Clear** (danger link, `delete` icon, right). Clear replaces "Delete all" (see the ConfirmDialogs card for its confirmation).
- **Eraser:** the fourth tool is named "Eraser", not "Erase" (ticket 250, ticket 176): the verb stays for the action ("Erase the stray bead"). Its icon is `erase`, its key `4`.
- **Hand** moves the open canvas by dragging; holding Space with any tool does the same.
- **Frame** is a tab: pressing it, or `6`, starts Set Frame (Esc leaves it). The Frame row in the Toolbox still shows the Frame's number and size (Frame card).
- **Input mode toggle (ticket 325):** on a touch-capable device a seventh tile follows Frame (so it starts the second row): the Pen mode / Mouse mode toggle, a tab-sized button with `pen-mode` or `pen-mode-off` in `accent` and no underline, `aria-pressed` while in Pen mode. Not a tool: it never changes the active tool.
- The consumer provides the active tool and handlers; the six tools are fixed. Classes: `bb-tools`, `bb-tool`, `bb-tool-remove`, `bb-tool-actions`.
- Other tiers: the iPad toolbar, the phone Dock and the ToolSheet use the same icon scale, underline and key where their size allows (see their cards).

Updated in ticket 292 (v18 had 28px tiles with an inset outline).
