# KeyboardFocus

The Tab order across the desktop layout and the keyboard rules: one stop per group, arrows inside, Escape closes the top-most layer.

- Order (ADR 0075): Canvas strip (three stops: Menu/Project/Frame, the Wordmark, the right-hand tools), Tool pill, Progress bar, Frame controls, Selection bar. There is no skip link.
- Roving tabindex inside each stop; the arrows of its axis step and stop at the ends (the Tool pill: ↑/↓ docked left or right, ←/→ top or bottom). Enter or ↓ opens Menu, Project and Frame; an open Menu wraps Tab inside itself. The Pattern takes no keyboard focus (ADR 0074).
- Modals and the modal Pattern sheet trap focus and return it to their opener.
- The ring is `focus-ring` (`ink`: neutral, never yellow or orange), 2px, just inside the control's edge (3px black in high contrast); `scroll-margin` keeps focused things clear of the header and Dock.
- **On a lit control** (ticket 0857), one filled with `ink` (Rulers on, Edit Frame on, a chosen segment), an `ink` ring would vanish into the fill: there the ring is `surface` (`--focus-ring-lit`), drawn inside the control's ink edge (`--focus-offset-lit`, the usual offset less the ring's width), so the edge stays and the light ring shows against the fill in every theme.
- **The Frame's controls on the margin sheet** (ticket 0857): Row progress, the Move bar and the tools are a stop each, ←/→ along the tools; the title block's name is the next stop (MarginSheet card).
- **The colour popover** (ticket 0857): opened from the keyboard, focus goes to the chosen swatch; the arrows move among the swatches, Enter chooses, and choosing or Escape gives focus back to the Colors tile, whose Tooltip is hidden while the popover is open (ToolPill card).

Hand-written from the Phase C sign-off.

- **Menu and Project (spec 0440):** the strip buttons are `aria-haspopup="menu"` with `aria-expanded`. The dropdown is a `role="menu"`: arrows, Home and End move, Enter chooses, Escape or Tab closes and focus returns to the button, on every screen size. A pencil opens its field with focus in it; Enter saves, Escape cancels and focus returns to the pencil.
