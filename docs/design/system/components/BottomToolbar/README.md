# BottomToolbar

The iPad mini's toolbar: the six tools (Paint, Fill, Select, Eraser, Hand, Frame), the current colour, Undo and Redo, under the thumb so drawing never needs the drawer.

- Same anatomy as the phone Dock (64px plus the bottom safe-area inset, 22px icons over 11px labels, active tool in `accent`).
- Everything else lives in the Drawer, opened from the header.
- **Same icons as the Toolbox (v18):** the six tool icons are the Toolbox's own (`paint`, `fill`, `select`, `erase`, `hand`, `frame`), drawn at 22px; Frame is a tool here as it is in the Toolbox, and still can be set from the Frame row or the Progress bar.
- **Tabs (ticket 292):** the six tools are the Toolbox's tabs: 56px wide, as tall as the bar, 34px icon, no tile background, selected by a 2px accent underline (3px in high contrast). The iPad's 744px width fits all six beside the other buttons; below 44px they would wrap, so none shrinks. Flagged for a visual check on a real iPad.
- **Hotkey corner:** each tool button prints its key (1 to 6: Paint, Fill, Select, Eraser, Hand, Frame) against the icon's top-right corner, as the Toolbox tabs do (ticket 292): DM Mono 11px, `muted`; `accent` on the active tool (`kc`). Color, Undo and Redo have no corner key (Undo and Redo are Ctrl/Cmd+Z chords, too long for a corner).

Hand-written from the responsive sign-off; static rendition.
