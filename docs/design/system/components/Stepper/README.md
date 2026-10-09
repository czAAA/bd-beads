# Stepper

The − value + control for every counted setting on desktop: Mirror axes, Size, Colors at most.

- The desktop form of the phone's steppers, for every "−  value  +" in the app (Mirror axes, Size, Colors at most): 40px tall, 40px buttons, the value in `meta` at 15px between hairlines.
- At the limit the button turns `faint` (e.g. − at 2 colours). A locked stepper is all `faint` on `surface`, and the reason is written under it, not hidden in a tooltip (a disabled control shows none).
- Each button has its own name for screen readers: "Fewer columns", "More columns".
- Holding a button repeats (ticket 355): one step at once, after 400ms it keeps stepping, from every 160ms down to every 30ms, until release, pointer leave or the limit. Mouse, touch and Enter/Space all hold; a held press adds no step on release.
- The number is a button named for the setting ("Width"); tapping it turns it into a numeric input in place, same size and look. Enter or blur commits, Escape cancels, an out-of-range number is clamped to min/max, empty or invalid input reverts. A locked stepper cannot be edited. The New Project number fields already take typing, so their compact up/down buttons only repeat.

Hand-written from the Phase A sign-off (forms, screens and states); static rendition.
