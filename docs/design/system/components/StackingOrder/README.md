# StackingOrder

Which layer sits above which: the twelve `zIndex` tokens, from the canvas overlays up to tooltips.

- `z-canvas-overlay` 10, `z-chrome` 20, `z-context-bar` 30, `z-drawer` 40, `z-sheet` 50, `z-popover` 60, `z-toast` 70, `z-modal` 80, `z-tour-dim` 84, `z-tour-connector` 85, `z-tour-card` 86 (the Tour, v15), `z-tooltip` 90 (as `--z-*` in tokens.css).
- A scrim sits one below its layer (39, 49, 79). Toasts are above sheets so a result is never hidden, and below modals.
- One modal at a time; a confirmation opened from a sheet stacks above it and returns focus to it. Nothing inside the canvas box goes above `z-canvas-overlay`.

Hand-written from the Phase C sign-off.
