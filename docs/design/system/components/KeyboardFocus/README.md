# KeyboardFocus

The Tab order across the desktop layout and the keyboard rules: one stop per group, arrows inside, Escape closes the top-most layer.

- Order: Skip to Pattern, Header, Toolbox, Save box, Beads needed, Saved Patterns, Canvas strip, Pattern, Progress bar.
- Roving tabindex inside the tool tiles, swatches and segmented controls. The Pattern is one stop with a bead cursor (arrows move, Space or Enter paints).
- Modals, the Drawer and the modal Pattern sheet trap focus and return it to their opener.
- The ring is `focus-ring`, 2px, 2px away (3px in high contrast); `scroll-margin` keeps focused things clear of the header and Dock.

Hand-written from the Phase C sign-off.
