# NewPatternForm

The form that makes a new Pattern, in the left column while no Pattern is open.

- Takes the Toolbox's place in the left column while no Pattern is open (and on the phone, a full-height modal sheet from the Pattern sheet's New Pattern).
- Order: Name (optional, a placeholder name is used), Bead, Technique, then **Frame (optional)**: Width and Height with their Unit. Bead and Technique are preset and can be changed at any time. Once a size is typed, the estimate in the other unit sits beside the Frame label ("≈ 64×48 mm", or "≈ 40×30 beads" when the unit is mm).
- **Size is optional (v16).** With both Frame fields empty, Create Pattern is enabled and opens an open canvas with no Frame; the hint says "Leave it empty to draw anywhere. Set Frame later, before you export." With one field filled the other is required, and the reason is written at the field (the second state in the preview).
- "or" then Convert image, which needs a Frame size: "A picture needs a Frame size. It becomes the first piece, and you can still draw outside it."
- Convert image warnings (slow framing) use the warning icon; its errors (HEIC, SVG, too big, too many pixels, unreadable, wrong format) use the error style, with the app's existing sentences.

Hand-written from the Phase A sign-off (forms, screens and states) and the v16 sign-off; static rendition.
