# BeadBoard

How a Pattern is drawn: beads on a rounded board, with rulers, the current-row marker, and the technique word and curve behind.

- **Board:** `board` rounded rectangle (radius-board, 32px) with 14px padding. Rulers sit outside it, top and left (`ruler` role, `ruler` color; every 5th number bold in `body`, the current row's in `marker`, weight 700; see the Rulers card).
- **Beads:** 2px gap. Shape comes from the Bead's form factor and Technique; a rounded bead has corners at 22% of its width. Light draws a faint `bead-rim` at 0.75px; dark draws none.
- **Finished rows:** light fades each bead's own color toward the board (28% color, 72% `board`), not grey; dark draws the bead's grey at 45% over the board.
- **Current row:** a 2px `marker` outline, 3px outside the row, radius 5.
- **Background highlight:** the Technique word ("Loom", `word` role in `word` color, bottom-right, partly covered by the board) and one 1.5px `curve` stroke. Decoration only: aria-hidden, never interactive, never in exports.
- Empty positions use `bead-empty`; brick stitch seams `bead-seam`; the hover outline with no color `bead-outline`.
- **PNG and PDF exports always use the light values.**

Hand-written from DESIGN.md §4.4 and §7; static rendition (the app draws this on a canvas renderer). The preview's finished-row fade uses the light rule in both themes.
