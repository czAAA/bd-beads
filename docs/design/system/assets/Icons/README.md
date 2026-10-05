# Icons

Icons v2: 53 single-ink SVGs on a 24-unit grid, stroke 1.75, round caps and joins, no fill, drawn in `ink` #1f1f1f because `<img>` cannot inherit colour; inline them in UI with `stroke: currentColor`. The bead (a zero-length stroke at 2.6) is the signature. Which icon goes where is in the brand book's Iconography section. Phase E added `device` (Match device) and `contrast` (High contrast) for the theme control; ticket 188 added `bead` (the app's own compact-header mark), `library` (Saved Patterns) and `paste` (the phone Edit sheet's Paste, no longer reusing import).

v15 added `menu` (three lines, the same 1.75 stroke, round caps and 4–20 span as `row-progress`): the HeaderMenu button next to the logo.
v15 also added `pattern` (a 12×17 board, radius 3.5, with two columns of three beads at stroke 2.6): the Dock's Pattern button, so it no longer reads as Save.
v16 added three for the open canvas: `frame` (four crossing lines, two upright and two level, like crop marks: the Frame row, every Set Frame button and the Dock's Frame button), `ruler` (a rounded bar with three ticks, the middle one longer: the Rulers toggle) and `hand` (an open hand, one stroke: the Hand tool). `size` no longer marks a Toolbox row; it stays for the phone header's bead and technique selector.
v16 also redrew `paint` as a pencil (a body, a rounded eraser end and a wood cone, one 1.75 stroke, no bead) so the Paint tool looks the way a drawing tool is expected to, and added `palette` (a round palette with a thumb notch and four bead dabs at stroke 2.6): the Colors button's own icon, so Colors and Paint no longer share one glyph.

`more` (three dots) is reserved: no card places it yet, so the app does not draw it. `pattern` is the Dock's Project button; `delete` is Clear.
