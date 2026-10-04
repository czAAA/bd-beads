# ToolTabs

The Tools group: six compact icon tiles (Paint, Fill, Select, Erase, Hand, Frame) on the same grid as the Palette swatches, with Remove Frame, Remove line and Clear underneath.

- **Tiles (v18):** the same 8-column grid as PaletteSwatches (gap 6, square, `radius-sm`), so a tile is exactly a swatch in size (about 28px in the 264px Toolbox) and the six tools fill the first six columns, with two left free. Fill `elevated`, no border. Icon 16px, `muted`, centered in the tile first (nothing else takes part in centering); no text label.
- **Active:** the icon turns `ink` and the tile gets a 1.5px inset `accent-strong` outline (`accent` yellow in dark; 3px in high contrast; a 2px `Highlight` outline in forced colors). There is no underline and no rule.
- **Hotkey corner:** each tile prints its key in the top-right corner: 1 Paint, 2 Fill, 3 Select, E Erase, H Hand, F Frame. DM Mono 10px, `muted` (`ink` on the active tile and in high contrast), 1px from the top and 2px from the right, absolutely positioned so it never moves the icon (`bb-tool-key`, `aria-hidden`). It is also in the tooltip ("Paint (1)") and in `aria-keyshortcuts`, and it shows on every device (the Dock and the iPad toolbar print the same corner key). Each tile is named by its tool ("Paint"), not by the key.
- 12px below the tiles: **Remove Frame** (link, `close` icon, left). It removes the Frame and is disabled while there is none.
- 10px below: **Remove line** (link, left, `faint` while there is no line to remove) and **Clear** (danger link, `delete` icon, right). Clear replaces "Delete all" (see the ConfirmDialogs card for its confirmation).
- **Hand** moves the open canvas by dragging; holding Space with any tool does the same.
- **Frame** is a tool tile again (it was the Frame row only in v16): pressing it, or `F`, starts Set Frame. The Frame row in the Toolbox still shows the Frame's number and size (Frame card).
- The consumer provides the active tool and handlers; the six tools are fixed. Classes: `bb-tools`, `bb-tool`, `bb-tool-remove`, `bb-tool-actions`.

Updated in v18 from the running app's Toolbox; static rendition.
