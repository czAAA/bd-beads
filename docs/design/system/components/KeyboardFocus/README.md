# KeyboardFocus

The Tab order across the desktop layout and the keyboard rules: one stop per group, arrows inside, Escape closes the top-most layer.

- Order (ADR 0075): Canvas strip (three stops: Menu/Project/Frame, the Wordmark, the right-hand tools), Tool pill, Progress bar, Frame controls, Selection bar. There is no skip link.
- Roving tabindex inside each stop; the arrows of its axis step and stop at the ends (the Tool pill: ↑/↓ docked left or right, ←/→ top or bottom). Enter or ↓ opens Menu, Project and Frame; an open Menu wraps Tab inside itself. The Pattern takes no keyboard focus (ADR 0074).
- Modals and the modal Pattern sheet trap focus and return it to their opener.
- The ring is `focus-ring` (`ink`: neutral, never yellow or orange), 2px, just inside the control's edge (3px black in high contrast); `scroll-margin` keeps focused things clear of the header and Dock.

Hand-written from the Phase C sign-off.

- **Menu and Project (spec 0440):** the strip buttons are `aria-haspopup="menu"` with `aria-expanded`. The dropdown is a `role="menu"`: arrows, Home and End move, Enter chooses, Escape or Tab closes and focus returns to the button, on every screen size. A pencil opens its field with focus in it; Enter saves, Escape cancels and focus returns to the pencil.
