# RadialToolbox

A ring of the ten most used drawing actions that opens round the pointer, so a maker changes tool or colour without travelling to the Tool pill. On a 13-inch screen the pill, docked at one edge, can be most of the screen away from the bead being drawn.

**In the app since ticket 1064:** the ring, its opening by a right click and picking by a click; since ticket 1065 its opening by a hold. **Since ticket 1076:** the ring kept on the screen near an edge and the pressed bead's outline (Anatomy). **Since ticket 1077:** the slide. **Since ticket 1089:** Pick color from Canvas arms the pick instead of taking the pressed bead's colour. The whole was signed off on mockups taken on the real editor, so its tickets build from this one text: each part below names its ticket, and that ticket removes the note when it lands. The decisions and what was turned down are in ADR 0098 (the Radial toolbox: ten actions in a ring round the pointer).

Sizes are this design system's px (1/16 rem in the app). Angles are degrees clockwise from straight up.

## What it holds (ticket 1064)

Ten items, the same ten everywhere, each always in its place:

- **Tools**, with the Tool pill's icons and in its order: Paint, Fill, Select, Eraser.
- **History**, with the Canvas strip's icons: Undo, Redo.
- **Colours:** Pick color from Canvas, then the three recent colours the Tool pill shows, in the pill's order.

Left out on purpose: Hand (two fingers, Space and the right button's drag already move the Canvas), Select a Piece and Mirror (rare, and set up from the pill), Paste (paste mode is already on after Copy or Cut), zoom. With a Selection under the press the ring is the same: the Selection bar holds the Selection's actions.

Every item runs the code path its existing control runs, so nothing is reachable only from the ring and nothing behaves differently in it. It has no settings and no panel.

## Anatomy (ticket 1064)

- **The band:** `pill-thickness` (48) across, on `radial-radius` (84, from the centre to the tiles' centres). Its inner edge is 60 from the centre and its outer edge 108, so the ring is 216 across round a hole of 120. It is one shape with a hole, in the Tool pill's material: `elevated`, a 1px `line` edge on both rims (`line-strong` in high contrast), and the shadow `--elevation-float-filter`, which is `elevation-float` for a shape that is not a box (ToolPill card, Material).
- **The centre is empty.** The Canvas shows through the hole, so the pressed bead and the beads round it stay in sight, and a fingertip fits inside it: every item starts beyond the finger. While the ring is open (ticket 1076) the pressed bead, or the empty position, keeps the Pattern's hover outline, 2px `bead-outline` (BeadHover card), so it is clear where the ring was opened once the pointer has left it or the ring has moved in from an edge.
- **No names on the ring.** Icons only, as in the pill.
- **Dividers** part the three groups: the pill's divider turned, 24 long centred on the 84 radius, 1px `line-soft`, at 68°, 112°, 248° and 292°.

### Where each item sits

| Item | Tile's centre | Slice |
|---|---|---|
| Pick color from Canvas | 309° | 34° |
| Recent 1 | 343° | 34° |
| Recent 2 | 17° | 34° |
| Recent 3 | 51° | 34° |
| Redo | 90° | 44° |
| Eraser | 129° | 34° |
| Select | 163° | 34° |
| Fill | 197° | 34° |
| Paint | 231° | 34° |
| Undo | 270° | 44° |

- **The colours are over the top and the tools under,** both read left to right in the pill's order: the pill folded in two. Undo and Redo sit on the side their arrows point to and part the two arcs.
- **Why the colours are on top:** they are the only items whose content changes, so they have to be read, and the top is in sight for both hands. A tool never moves, so its place is learned once.
- **It does not turn for a left hand.** Each hand covers the two tools on its own side; turning the arc would only swap which two.
- **A slice** is half its angle each way from the tile's centre, from the hole's edge (60) outward with no end. It is the item's hit area: at its smallest it holds a circle of 49 × 48, over `touch-target`, and no point belongs to two items (accessibility.md, ticket 0962). Because nothing lies beyond the ring, a slide that goes too far still lands on the item it was aimed at (ticket 1077). A click or a tap picks inside the band only: beyond its outer edge it is an Outside press. Inside the hole nothing is picked.

### The items

- **A tool, Undo, Redo:** the Tool pill's tile: 40, `radius-lg`, a 22 icon in `muted` (ToolPill card, Tool tiles). No hotkey digit.
- **The active tool** wears the pill's pressed look (`panel` inside the inset `ink` outline, the icon in `accent-strong`), by the pill's own rule: so no tool is pressed while Pick color from canvas waits for a bead or in Mirror mode.
- **Pick color from Canvas:** the plain `eyedropper` at 22 on the same tile, as in the Palette (PaletteSwatches card). It does what that button does (ticket 1089): it arms the pick, so the next press on a bead takes its colour, wherever the ring was opened, and it wears the pressed look while the pick waits for a bead; picked then, it ends the pick. It is never off.
- **A recent colour:** a round swatch of `--radial-swatch` (24; the pill's is 18, here the colours are the main thing) with the inset 1px `field-line` ring, on a 40 tile with `radius-lg`. A colour is round and a tool is a tile: that is how the two differ.

## States (ticket 1064)

- **Resting:** as above.
- **Under a mouse:** the tile's hover look, `hover-fill` and the icon in `ink`.
- **Under a finger or the Pencil mid-slide** (ticket 1077): the pressed look, `press-fill` and the icon in `ink`, one step stronger. On touch it is the only thing that says where the lift will land. It shows once the lift would pick: after the pointer has moved 8px since the ring opened (Picking).
- **The name of the item under the pointer:** the Tooltip's bubble (same fill, edge, radius, type and shadow), centred over the ring, `space-8` above its outer edge and kept `float-edge` inside the screen. The name in bold; after it, in the Tooltip's meta style, a recent colour's hex. It shows at once, with no hover delay: the ring was asked for. An item that is off shows its name too, without the hover look. Over the ring no hand covers it, so it also says what is under a finger.
- **Off:** the icon in `faint`, no hover, no press, `aria-disabled`. Undo and Redo when there is nothing to undo or redo (a new Project has neither). A lift, a tap or a click on an item that is off does nothing and the ring stays.
- **A recent colour that does not exist yet** (a new device) keeps its place as a 24 ring, 1px dashed `line-strong`, and is off.
- **Right after a pick:** the ring leaves (Motion, below) with the picked tile in `press-fill`. Nothing else confirms it: the Tool pill and the cursor change already.
- **Themes:** light, dark and high contrast by the tokens above. High contrast casts no shadow and draws the pressed tile's outline at 2px, as the pill.

## Opening

- **With a mouse or trackpad (ticket 1064):** a right click on the Canvas. A right-button press does nothing yet; if the pointer moves 8px with the button down it is a pan, as the middle button's, until the button lifts; if the button lifts without that move, the ring opens centred on the pressed point. The browser's own menu stays shut over the Canvas.
- **With a finger or the Pencil (ticket 1065):** a hold on the Canvas with the pointer that draws: the pen in Pen mode, the finger in Mouse mode. In Pen mode a finger never opens it, since a resting palm is a long, still touch, and in Mouse mode the pen, which moves the Canvas, never opens it.
- **Where:** under any tool, on a bead or on an empty position, on the Canvas or in the Frame, over the Frame's margin too. A press on a handle (the Frame's, a Selection's, the Mirror Area's) is the handle's and opens nothing. It does not open while the Canvas is read-only.
- **No key opens it:** every item already has its key.
- **On the Homepage's demo (ticket 1114):** only the tour's ghost opens it, in its Tools at the pointer row (Homepage card); a visitor's press opens nothing there, as it works nothing else in the demo.

### The hold (ticket 1065)

- **How long:** `--hold-duration` (450ms), a little shorter than the long-press that shows a control's Tooltip (500ms), so the ring comes quickly.
- **A move is still a stroke.** If the pointer moves 8px before the hold is up, the hold is off and the stroke goes on. That 8px is the Tool pill's drag threshold and the right button's above: one value. A second finger ends the hold too.
- **What is seen:** nothing for `--hold-quiet` (150ms), so a tap never shows anything. Then a hairline in `ink`, `--pill-tile-outline` wide with round ends, is drawn once round the pressed point, clockwise from the top, on a circle of radius 60: where the ring's inner edge will be, and wider than a fingertip. It closes as the hold ends, and the ring comes in where it was.
- **Nothing is left behind.** Paint, Eraser and Select start at the press, so a tap is as quick as without the hold; when the hold completes that start is dropped, as the first finger of a pinch is: no bead, no Selection, no Undo step. **Fill lands at the lift,** on the bead that was pressed, so a hold never flashes a fill. A Piece tap, which selects at the press, gives back the Selection it replaced.
- **Not timed:** a press a handle takes, and the press Pick color from Canvas is waiting for, which takes its colour at once and cannot be taken back.
- **After it opens** the pointer is still down and belongs to no tool. A lift leaves the ring open for a tap; the slide (ticket 1077) picks in the same gesture.

## Picking

- **Tap or click (ticket 1064):** with the ring open, a tap or a click on an item picks it. A mouse picks this way only, since its drag is the pan.
- **Slide (ticket 1077):** hold, slide to an item, lift, in one gesture. The item is the one whose slice the lift is in, so the lift does not have to land on the tile.
- **Both live together (ticket 1077):** a hold lifted without sliding leaves the ring open for a tap. A lift picks only after the pointer has moved 8px since the ring opened, measured from where it was at that moment; this also covers a ring that has moved in from an edge, where the pointer may already be over a tile when it opens.
- **A tool or a colour closes the ring. Undo and Redo keep it open** (ticket 1064), since Undo is often wanted several times in a row. Undo goes off when nothing is left to undo; Redo comes on with the first Undo.
- **Nothing picked:** sliding out and back and lifting in the hole closes the ring. With the ring left open, a press in the hole or anywhere outside it is an Outside press: it closes the ring and does nothing else, and nothing under the press acts. Escape closes it too.
- **Opened again elsewhere (ticket 1147):** with the ring open, the press that opens it moves it. A right click on the Canvas closes the ring at the press and opens it again where it was pressed; a right-button drag pans with the ring closed. A hold with the drawing pointer closes the ring at the press, draws the hairline round the new point and opens the ring there, ready for the slide; lifted early or moved 8px first, the ring stays closed. Like an Outside press, that press is no tool's and no handle's. Every other press is an Outside press, as above.

## Edges (ticket 1076)

- **The ring stays under the pointer as often as it can.** It opens centred on the pressed point wherever the screen has room for it. Else it moves whole, by the least that keeps it `float-edge` inside the screen with room for its name on top: its centre stays at least 120 from the left, right and bottom edges (108 and `float-edge`) and 158 from the top (8 and 30 more, for the name). It never changes shape, and every item keeps its place. The name moves along the ring's top by the least that keeps it `float-edge` inside the screen at each side.
- **In a shell that lives in a box** (the Homepage's demo, ticket 1114) the box is its screen: the ring is placed in it, keeps the same room from its edges, and is drawn at the box's zoom, as the hold's hairline is.
- **It lies over what is there:** the Canvas strip, the Tool pill docked at any edge, the Progress bar, the Selection bar and the Mirror bar. It never moves clear of them, and they take no press while it is open.
- **Stacking (ticket 1064, in the app):** in the app shell at `z-popover`, as the colour popover is, so the canvas box never clips it (StackingOrder card). It is outside the Canvas's zoom, at a fixed size.

## Motion

- **In (ticket 1064):** opacity and scale from 94%, over `duration-base` with `ease-out`, the colour popover's pop.
- **Out (ticket 1064):** opacity over `--radial-out` (150ms) with `ease-in`.
- **One thing moves at a time (ticket 1065):** the hairline finishes, then the ring comes in. No glow, nothing bounces.
- **Reduced motion:** no hairline and no scale. The ring fades in when the hold is up and out again, in 120ms (`duration-fast`).

## How a maker learns it exists

One quiet place, the Canvas hint, which gains a part for the device in hand (CanvasHint card): "right-click for tools" with a keyboard (ticket 1064) and "hold the Canvas for tools" on touch (ticket 1065). "Tools" stands for the pill, colours included. Keyboard shortcuts carries the same as one row (ShortcutsHelp card). The First-run welcome does not grow. Before the editor is open, the Homepage's tour shows it: its Tools at the pointer row opens the ring by a hold and by a click, and its caption names both (Homepage card, ticket 1114).

## Accessibility (ticket 1064)

- A `toolbar` named "Tools", as the pill; each item is a button with the name its existing control has, and `aria-pressed` on the active tool.
- Opened by a pointer, so focus stays where it was. Escape closes it.
- It adds nothing a keyboard or a screen reader lacks: every item is on the Tool pill, the Canvas strip or the Palette, each with its key.
- On a phone it only has to not break: the ring is 243px across on screen and fits the narrowest one.

Hand-written from the Radial toolbox sign-off (2026-11-18); not drawn in the preview.
