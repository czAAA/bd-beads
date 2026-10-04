# BottomToolbar

The iPad mini's toolbar: the six tools (Paint, Fill, Select, Erase, Hand, Frame), the current colour, Undo and Redo, under the thumb so drawing never needs the drawer.

- Same anatomy as the phone Dock (64px plus the bottom safe-area inset, 22px icons over 11px labels, active tool in `accent`).
- Everything else lives in the Drawer, opened from the header.
- **Same icons as the Toolbox (v18):** the six tool icons are the Toolbox's own (`paint`, `fill`, `select`, `erase`, `hand`, `frame`), drawn at 22px; Frame is a tool here as it is in the Toolbox, and still can be set from the Frame row or the Progress bar.
- **Hotkey corner:** each tool button prints its key (1, 2, 3, E, H, F) in the top-right corner, as the Toolbox tiles do: DM Mono 11px, `muted`, 3px from the top and 4px from the right, absolutely positioned so the icon and label stay centered; `accent` on the active tool (`kc`). Color, Undo and Redo have no corner key (Undo and Redo are Ctrl/Cmd+Z chords, too long for a corner).

Hand-written from the responsive sign-off; static rendition.
