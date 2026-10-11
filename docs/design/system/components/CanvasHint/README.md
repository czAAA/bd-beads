# CanvasHint

The one line in the bottom-left corner of the drawing area that says how to move the open canvas and names its shortcuts.

- **Text:** "scroll or `space` drag to move · `⌘` scroll to zoom · `H` Hand · `F` Set Frame · `R` Rulers". Inter 12/16 in `muted`; each key is a Kbd chip, 20px here, with 10px before every chip after the first.
- **Place:** 14px from the left edge and 12px from the bottom of the drawing area, above the technique word and under any overlay. It does not move with the canvas.
- **Always shown** while a Pattern is open, with or without a Frame, at 1024px and up. Not under 1024px, which has no wheel and no keyboard.
- On Windows and Linux the `⌘` chip reads "Ctrl".
- aria-hidden: the same shortcuts are listed in Keyboard shortcuts (ShortcutsHelp).

Hand-written from the v16 sign-off (open canvas mockups); static rendition.
