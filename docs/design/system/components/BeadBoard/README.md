# BeadBoard

How a Pattern is drawn: beads on an open canvas you can draw on anywhere, in pieces that carry their own rulers, with the technique word and curve behind.

- **Open canvas (v16):** there is no board. The drawing area is one background (CanvasBackground) covered edge to edge with the positions of the chosen Technique, each marked by a Position mark in `position-mark` (starts from `bead-empty`), at the bead pitch. Position marks come in two styles, a device preference chosen in the Canvas color popover: **Dots** (the default), a 1.5px dot; and **Squares**, a 1 CSS px outline in the 1px gap round the position, clear inside so the Canvas color shows through, with the Technique's bead corner radius (rounded for peyote, square otherwise) and the half-bead row shift of peyote and brick stitch. Both styles use the same color in each theme, and are never saved with a Project or drawn in exports. Painting works at every position. The canvas has no edge and no size; it is moved, never resized.
- **Moving and zooming:** the wheel or two fingers move the canvas, and so do Space + drag and the Hand tool (`H`). ⌘ or Ctrl + wheel and pinch zoom, as do the canvas strip's buttons. The CanvasHint names these in the bottom-left corner.
- **Pieces:** beads that touch by a side or a corner form one piece. Until a Frame is set, each piece has a 1px `line-strong` rectangle 5px outside its beads (radius 6; it does not change while you draw) and its own rulers above and on the left (Rulers card).
- **The Frame** marks the part of the canvas that is the Pattern (Frame card). Inside a set Frame, empty positions draw as full `bead-empty` beads instead of dots.
- **Beads:** 2px gap. Shape comes from the Bead's form factor and Technique; a rounded bead has corners at 22% of its width. Light draws a faint `bead-rim` at 0.75px; dark draws none.
- **Finished rows** (inside the Frame): light fades each bead's own color toward the canvas background (28% color, 72% background), not grey; dark draws the bead's grey at 45% over it.
- **Current row:** a 2px `marker` outline, 3px outside the row, radius 5, as wide as the Frame.
- **Background highlight:** the Technique word ("Loom", `word` role in `word` color) and one 1.5px `curve` stroke, fixed to the drawing area: they stay put while the canvas moves. Decoration only: aria-hidden, never interactive, never in exports.
- Empty positions use `bead-empty`; brick stitch seams `bead-seam`; the hover outline with no color `bead-outline`.
- **PNG and PDF exports always use the light values**, and still draw the Frame's beads on a board (`print-board`).

Hand-written from DESIGN.md §4.4 and §7 and the v16 sign-off (open canvas mockups); static rendition (the app draws this on a canvas renderer).
