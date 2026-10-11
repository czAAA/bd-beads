# Motion

How things move: four durations, three easings, and the rules that keep motion off the Pattern; the buttons in the preview play each motion.

- `--duration-instant` 80ms (press, bead hover), `--duration-fast` 120ms (hover, colour, tooltips), `--duration-base` 200ms (menus, popovers, toasts, modals, disclosure rows, the row marker; leaving 150ms), `--duration-slow` 280ms (sheets and the Drawer arriving; leaving 200ms).
- `--ease-out` for arriving, `--ease-in` for leaving, `--ease-standard` for moving. No bounce, no overshoot.
- Only `transform` and `opacity` animate over the canvas; the drawing surface never resizes during an animation (ADR 0018). Height animates only inside the left column.
- Row done glides the current-row marker to the next row (200ms): the one motion on the Pattern. Painting, the theme switch and zoom steps are instant.
- Toasts leave after 5s unless hovered or focused; errors stay.
- Reduced motion: sheets, menus and modals fade in 120ms instead of sliding; the marker jumps; loading beads stand still.

Hand-written from the Phase B sign-off; the tokens and classes live in `components/bundle.css`.
