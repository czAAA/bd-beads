# TextField

A single-line text input with its label, hint and error.

- Label above (`control`, 14/20 500), 6px to a 40px field: `elevated` fill, 1px `field-line`, radius-md, 14px text, 12px padding.
- Placeholder in `muted`. Focus: `ink` border plus the 2px `focus-ring`. Error: `danger` border and a 13px `danger` message with the warning icon under it. Disabled: `surface`, `faint` text.
- Hint text 13/18 `muted`. "optional" sits right of the label in `meta-small`. Fields are 40px (not 34) because people type in them; 44px hit area on touch.

Hand-written from the Phase A sign-off (forms, screens and states); static rendition.

Compact variant (ticket 517, the app only): the Frame bar's width and height boxes are 2rem high (not 40px), `surface` fill, 1px `line-strong`, 6px padding and 15px `title` text, because they sit in a toolbar. Off, they ignore presses so the group's Tooltip answers.
