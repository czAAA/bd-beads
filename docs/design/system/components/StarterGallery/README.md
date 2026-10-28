# StarterGallery

The Starter gallery: ready-made designs, each putting one Frame in place, filled or empty. It opens from New Project's **Pick a starter** and from the Frame panel: **Frame from starter** with no Frame, or the **Replace Frame** row under the Frame's size when there is one (held still once a pass is done), in the panel's subpanels: step 1 the categories, step 2 a category's options, then one option's setup. (Spec 0590, ticket 0595; design canvas https://claude.ai/artifact/Lz2xUWXXF6KpFkgxS39WJB.)

Built by ticket 0596 (step 1, the Shapes and the setup) and ticket 0597 (Earrings, Rings and Bands).

## The levels

All three are subpanels (MenuPanel card): the header is the Back icon button and the level's title in `title`, with a `meta` crumb at the right ("starter", "starter · shapes"). The body scrolls under the pinned header.

- The crumb names the levels above: none on step 1, "starter" on step 2, "starter · shapes" on a setup.
- **Step 1, Starter.** A lead line, "Each Starter is a finished design for one Frame. Use it as it is, or start with its shape empty.", then four category cards: **Shapes** ("5 shapes"), **Earrings** ("2 fringe styles"), **Rings** ("4 motifs"), **Bands** ("4 motifs").
- **Step 2, the options.** The category's name as the title, a lead line, then one card per option:
  - Shapes: Triangle, Warped Square, Kite, Star, Kaleidocycle (Medallion later).
  - Earrings: Straight fringe, V fringe (looped fringe later).
  - Rings and Bands: Stripes, Chevrons, Diamonds, Plaid.
- **Setup.** One level deeper, under the option's name: its picture, its settings and the footer (Setup, below).

## Card

- A `button` with the picture on top and the caption under it: `elevated` fill, 1px `line-strong` edge, `radius-lg` (12px: a picture card is a box, larger than the 8px `radius-md` of controls), no padding round the picture.
- **Picture well:** square, as wide as the column, `surface` fill, a 1px `line` under it. The column is the panel's width less two 16px gutters and the 12px gap: 173px in a 390px phone, 236px in the 520px desktop panel.
- **Caption:** padding 10 12 12, 2px between lines. The name in `control`, `ink`. On a step 2 card, two `meta` lines in `muted`: the size the design is made for ("10 rounds", "part size 5", "7 wide · eu 54", "11 wide · wrist 16 cm") and its bead count ("165 beads", "87 beads each", "≈ 125 beads": ≈ where the count is an estimate). A step 1 card has one `meta` line, the count of options.
- **Grid:** two columns at every width, 12px gap. The cards in a row take the tallest caption's height; text wraps, nothing is cut.
- **States:** hover `hover-fill` with a `body` edge, the picture scaling to 1.04 (`duration-base`, `ease-out`), and in light a soft shadow (`elevation-1`, 0 4px 12px; none in dark); pressed `press-fill` with an `ink` edge, the picture at 0.97; keyboard focus the 2px `focus-ring` just inside the edge. Dark: no shadow, the cards on `elevated` over the panel, the pictures' wells on `surface`, and the theme's `accent` (neon yellow) on the pressed chip, segment and footer button. High contrast: 2px `line-strong` edge, 3px focus ring. With reduced motion the picture does not scale.
- **Keyboard:** each grid is one Tab stop with a roving tabindex: the arrows move along a row and between rows, Home and End go to the first and last card, Enter or Space opens its level.
- The picture is decorative (`aria-hidden`); the card's name is its accessible name, its caption its description.

## Pictures

Each picture is the option's design, a Project file kept with the app, drawn by the Project renderer in Real bead shape with Color catalog colours, fitted to its well with 7% padding and never cropped. Colours stay as painted whatever Bead is chosen. A category card shows its best option: the Star, a pair of V fringe earrings, a Ring and a Band.

How each kind lays its Beads (these are also the Frame kinds' layouts and counts, spec 0590):

| Kind | Size setting | Layout | Beads |
| --- | --- | --- | --- |
| Triangle | Rounds *n* (design 10) | Three wedges, one per side, each Bead pointing straight in from its side. A wedge's row *d*, half a Bead in from the side, holds *n* − *d* Beads on every other column, so rows stagger and every column starts at the side; about 2.3 columns stay empty at each corner, where the rows step in along the seams to the centre. | 3*n*(*n* + 1) / 2, so 165 |
| Warped Square | Rounds *n* (design 8) | An X of four wings, Beads pointing at the centre; every column starts at a seam diagonal, so the outer edges step and the notches between the wings stay open. Bead *k* in from the seam on column *j* is in round \|*j*\| + 2*k* + 1. | 2*n*(*n* + 1), so 144 |
| Kite | Rows *n* from the point (design 21) | Two peyote wings meeting at a vertical spine, as the Kite Frame kind lays them (ticket 0593): a row grows a Bead a wing to its widest a fifth of the way down, then loses one every fourth row. | 96 at 21 rows |
| Star | Part size *n*, rounds of each arm (design 5) | Five Warped Square arms lying flat as rhombi round the centre, each beaded in *n* rounds from its own centre. | 10*n*(*n* + 1), so 300 |
| Kaleidocycle | Part size *n*, rounds a triangle (design 9, the least that folds well) | Six Triangles of *n* rounds round a small hexagonal hole, each beaded from its own centre. | 9*n*(*n* + 1), so 810 |
| Fringe earring | Top width, Top rows, Fringe style, Fringe length | A brick-stitch top worked up from its base row, one Bead shorter a row, and one strand under each base Bead. Fringe length is the longest strand; a V shortens by two Beads a strand out from the middle. | Top plus strands: V 87, Straight 97 |
| Ring, Band | Width (design 7 and 11) and the product size | Peyote rolled out flat, a section of it. On its card a Ring lies across and a Band stands upright, so the two read apart; both lie along the setup's picture. | Setup, below |

**Start empty picture:** each panel a plate in `elevated`, every Bead a 1px `muted` outline with its hole, the Seams 1.5px dashed `body`, and Off-shape a dot field in `line-strong` on `surface`. The same picture shows while Use design is off.

## Setup

In order, in the body:

1. The picture: 280px tall, the panel's width, `surface`, 1px `line-strong`, `radius-lg`. It updates as the settings change; it is `role="img"` named "{option}, with design" or "{option}, empty shape with seams".
2. **Name** and **Bead**, side by side, on New Project only (an open Project keeps its own Bead). Name is optional, with the option's name as its placeholder.
3. **Design:** a SegmentedControl, **Use design** (on by default) and **Start empty**. When it is off, a Note under it says why (below).
4. The option's settings, each under its `label`, with its unit at the right in `meta`:
   - A count is a Stepper (`field-height`) with the usual sizes as chips beside it (`item-height`, 44px hit, `radius-md`, `line-strong` edge; the matching one `aria-pressed` in `accent` with `on-accent` text). The chip of the design's own size carries a 5px dot, named "design size" for screen readers.
   - A choice is a SegmentedControl; its labels wrap to two lines rather than shrink (LongerText card).
5. **Estimated size** in a `surface` box, `radius-lg`, its value in DM Mono `control` at the right; under it, right-aligned in `meta`, the bead count and, for a Ring or Band, its rows.
6. The pinned footer (MenuPanel card): one primary button, 44px, the full width: **Create Project** on New Project, **Add Frame** on an open Project without a Frame, **Replace Frame** when it has one.

Settings and sizes by option (Delica 11/0: 1.6 mm by 1.3 mm; peyote rows 0.8 mm apart):

| Option | Settings (design size) | Chips | Estimated size |
| --- | --- | --- | --- |
| Triangle, Warped Square | Rounds, from the centre (10; 8) | 6 8 10 12; 6 8 10 | Its width × height in cm |
| Kite | Rows, from the point (21) | 15 21 30 | Width × height |
| Star | Part size, rounds a part (5) | 3 5 7 9 | Width × height |
| Kaleidocycle | Part size, rounds a triangle (9; 9 to 15) | 9 11 13 | Width × height |
| Fringe earrings | Top width, Beads in the base row (7); Top rows, one Bead fewer each, at most Top width − 1 (6); Fringe style, Straight fringe or V fringe; Fringe length, the longest strand (12 for V, 10 straight) | 5 7 9; 4 6 8 (those allowed); 8 12 16 for V, 8 10 12 16 straight, so its design's 10 has a chip | One earring's width × height; the count "87 beads each · 174 for the pair" |
| Ring | Width, Beads (7); Size system, EU or US (a view, not a size); Ring size (EU 54, US 7) | 5 7 9; EU 50 52 54 56 58 or US 5 6 7 8 9 | "ø 17.2 mm inside · 9.1 mm wide"; rows round the middle of the band, 4 mm longer than the finger, because a woven ring runs small: "72 rows round" |
| Band | Width, Beads (11); Wrist, cm measured snug (16); Fit, Snug, Comfortable or Loose (Comfortable) | 7 9 11 13; 15 16 17 18 | Wrist plus 1, 1.5 or 2 cm of ease, less 1.5 cm for the clasp: "1.4 × 16.0 cm"; "200 rows · 1.5 cm left for the clasp" |

EU ring sizes are the inside circumference in mm; US is worked out from it to the half size (US 7 is 54 mm). A Ring or Band's count is Width × rows / 2, an estimate.

**Use design.** The design is made for one size and is never cropped, scaled or repeated. Changing any size setting (not the Size system) turns Use design off, and the Note names the design's size: "The design is made for part size 5. Set it back to turn the design on." ("Choose it again" for a choice, as Fringe style or Fit). Setting every size back turns it on again. Choosing Start empty with the design's size shows "Start empty keeps the shape and its seams and leaves every Bead blank." Choosing Use design again puts back the design's sizes.

**Make.** Create Project, Add Frame or Replace Frame put the Frame of that kind and size in place, with the design's beads when Use design is on and none when it is off, and close the panel. Nothing in the Project records the Starter. Replace Frame asks first when the Frame holds beads (ConfirmDialogs card: "Replace Frame?", "The Frame's beads will be removed with it. This can be undone.", Cancel first and focused, Replace Frame primary) and is one Undo step.

## Back, Escape and focus

- Back and Escape go up one level at a time; focus lands on the card or row that opened the level. A level is entered on its first card, or the setup on its first field.
- From New Project: setup → Shapes (focus on the option's card) → Starter (on the category's card) → New Project (on Pick a starter) → the Menu list, or closed when New Project was the view the panel opened on.
- From the Frame panel: up to the Frame panel, focus on the row that opened Starter; Escape there closes the panel and focus goes to the Frame button.
- The panel is a `dialog` while a level shows and Tab stays inside it. In an open Bead picker, Escape closes the picker only; in the Replace Frame question it is Cancel. Closing the panel resets it to its root and drops the setup.

## Panel width

On desktop and tablet the panel is `panel-width`, 520px (585px at the app's 18px root; ticket 0598, for every panel), as the canvas draws it, so the two columns of cards get 236px pictures. On a phone the panel stays the screen less its 8px gutters, so the cards' column is 173px at 390px and 157px at 360px.
