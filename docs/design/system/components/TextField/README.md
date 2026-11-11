# TextField

A single-line text input with its label, hint and error.

- Label above (`control`, 14/20 500), 6px to a 40px field: `elevated` fill, 1px `field-line`, radius-md, 14px text, 12px padding.
- Placeholder in `muted`. Focus: `ink` border plus the 2px `focus-ring`. Error: `danger` border and a 13px `danger` message with the warning icon under it. Disabled: `surface`, `faint` text.
- Hint text 13/18 `muted`. "optional" sits right of the label in `meta-small`. Fields are 40px (not 34) because people type in them; 44px hit area on touch.

## Placeholder, value and limit (ticket 0854)

- **The placeholder says what goes in the field**, in a few words and no full stop: "Your name", "Project name", "Frame name", "Piece name", "Find a code or color", "Your email". It never reads like a value already set: no example name, no in-joke ("Bead Master" was one), no number that could be the field's own. It doesn't replace the label: the field keeps its label or accessible name.
- **A field whose emptiness falls back to a name** shows that name as its placeholder, since it is what will be used: New Project's Name (NewPatternForm card), a starter's Name, Convert image's Name (the picture's file name).
- **A field that holds a value shows it as its value**, in `ink`, never as a placeholder: the Frame's Width and Height hold the Frame's size, the colour's hex holds the colour. A field like that selects its text on focus (`selectOnFocus`), so typing replaces it, and a press's release keeps the selection. Emptied while typing, it shows what it keeps as its placeholder (the Frame's side).
- **A name has one limit, 40 characters**: a Project's (New Project, a starter, Convert image, Rename, Duplicate), the maker's, a Frame's and a Piece's. Its counter "n/40" in `meta` / `muted` (`FieldCounter`) shows under the field only from 30 characters on, and in `danger` past the limit, which only a name that came in longer (an older Project or a file) can be.
- **A name edited in place** (ProjectPanel and Frame cards, MarginSheet card) is saved by Enter, the check or a press outside, and cancelled by Escape or ×. Left as it was, it is kept whole even past the limit; changed and still too long, it is refused with "Use 40 characters or fewer." and nothing is cut without a word.

Hand-written from the Phase A sign-off (forms, screens and states); static rendition.

Multiline variant (ticket 0700): a textarea for free text (the FeedbackSheet's Message and Note), the same frame grown to its content with 8 12 padding, its starting height set by the form that holds it, pulled taller by its corner.

Compact variant (ticket 517, the app only): the Frame panel's width and height boxes are 2rem high (not 40px), `surface` fill, 1px `line-strong`, 6px padding and 15px `title` text, because they sit in a toolbar. Off, they ignore presses so the group's Tooltip answers.
