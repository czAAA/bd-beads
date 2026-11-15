# KeyboardFocus

The Tab order across the desktop layout and the keyboard rules: one stop per group, arrows inside, Escape closes the top-most layer.

- Order (ADR 0075, ADR 0093): Canvas strip (three stops: Menu/Project/Frame, the Wordmark, the right-hand tools), the Pattern, Tool pill, Progress bar, Frame controls, Selection bar. There is no skip link.
- Roving tabindex inside each stop; the arrows of its axis step and stop at the ends (the Tool pill: ↑/↓ docked left or right, ←/→ top or bottom). Enter or ↓ opens Menu, Project and Frame; an open Menu wraps Tab inside itself. The Pattern's arrows move its bead cursor (ADR 0093).
- Modals and the modal Pattern sheet trap focus and return it to their opener.
- The ring is `focus-ring` (`ink`: neutral, never yellow or orange), 2px, just inside the control's edge (3px black in high contrast); `scroll-margin` keeps focused things clear of the header and Dock.
- **On a lit control** (ticket 0857), one filled with `ink` (Rulers on, Edit Frame on, a chosen segment), an `ink` ring would vanish into the fill: there the ring is `surface` (`--focus-ring-lit`), drawn inside the control's ink edge (`--focus-offset-lit`, the usual offset less the ring's width), so the edge stays and the light ring shows against the fill in every theme.
- **On an accent or danger fill** (ticket 0938), a primary button (Row done, Send), an on switch, a chosen Starter chip, the accent File button, Mirror the whole Frame on: `focus-ring` would vanish into the yellow in dark (1.07:1), so the ring takes the fill's own label color, `on-accent` (`--focus-ring-on-accent`), at the usual offset; on the danger button it is `on-danger` (`--focus-ring-on-danger`). It stands 3:1 or more off the fill in light, dark and high contrast. A disabled primary is grey and keeps the usual ring.
- **On a swatch** (ticket 0938), whose fill can be any color, no one ring color shows on all of them: the ring is two-tone, `focus-ring` at the edge and a band of `surface` (`--focus-ring-band`) the ring's width inside it, so one of the two stands 3:1 off any fill and the two stand 3:1 off each other. The selected and recent rings outside the chip stay.
- **The bead cursor on the Pattern** (ticket 0942, ADR 0093): the Pattern itself draws no outline; its ring goes round the one bead the cursor is on, the swatch's two-tone ring above (a bead may be any color) standing `focus-width` clear of the bead, upright when the Canvas leans. It shows only for focus that came by keyboard; accessibility.md (Beads and the keyboard) has its keys.
- **The Frame's controls on the margin sheet** (ticket 0857): Row progress, the Move bar and the tools are a stop each, ←/→ along the tools; the title block's name is the next stop (MarginSheet card).
- **The colour popover** (ticket 0857): opened from the keyboard, focus goes to the chosen swatch; the arrows move among the swatches, Enter chooses, and choosing or Escape gives focus back to the Colors tile, whose Tooltip is hidden while the popover is open (ToolPill card).

Hand-written from the Phase C sign-off.

- **Menu and Project (spec 0440):** the strip buttons are `aria-expanded`, Project's also `aria-haspopup="dialog"` (ticket 0995; the Menu dropdown is a plain region, MenuPanel card): arrows, Home and End move, Enter chooses, Escape or Tab closes and focus returns to the button, on every screen size. A pencil opens its field with focus in it; Enter saves, Escape cancels and focus returns to the pencil.
