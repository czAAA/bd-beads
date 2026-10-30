# SchemaTag

The name of an unframed Schema (a named Piece on the Canvas, ADR 0050) as a small hang tag on a thread from the Piece's bottom-right corner, like the tag on a finished piece of jewelry. A short name is written on the tag; a longer one folds to a tag with three dots, and a click or tap opens it into a paper tag with the Schema's details. It replaces the name drawn as DM Mono text under the beads. Approved on the claude.ai canvas "Schema name tag" (variant B, Hang tag), 2026-10-30; built by ticket 0721.

- **What carries one:** every unframed Schema on the Canvas, one tag each. A framed Schema has none: its name is the Frame's, in the margin sheet's title block (MarginSheet card). A Frame that is removed leaves its Schema on the Canvas, and its tag comes back. A plain Piece (no name) has none.
- **The rule:** a name of **5 characters or fewer** is written on the tag ("Owl", "Fox 2"). A longer one shows **three dots** in its place. Characters are counted as a reader sees them (grapheme clusters), so a two-character Chinese name is written in full. Spaces count.
- **Where it hangs:** a 1px **thread** in `muted` from a 3.2px `ink` dot on the Piece's bottom-right corner (the corner of its rectangle, outside the beads by the Piece outset) down to the tag's hole, 9px right and 24px down (`--schema-tag-drop`), curving out to the right. The tag hangs from its hole, turned **10°** clockwise (`--schema-tag-tilt`), so it reads as hanging rather than placed.
- **The tag:** `--schema-tag-height` (22px) tall, filled `ink`. Its left end (`--schema-tag-end`, 8px) is cut on both corners like a luggage tag, with a 3.2px **hole** (`--schema-tag-hole`) that shows the canvas through it; the right end has `radius-xs` corners. The name in `canvas`, Inter 600 11/22 (`--schema-tag-name`), padded 3px after the end and 8px at the right. The dots are three 3px `canvas` discs 2px apart, padded 7px at the right.
- **Size:** the tag, thread and dot are measured in screen pixels and never scale with the zoom, so a tag reads the same at 25% as at 400%. At a far zoom-out the tag can be larger than its Piece; it still hangs from the corner.
- **Hover** (fine pointer): the tag straightens to 0° (`--duration-fast`, `--ease-out`; no turn under reduced motion), its fill becomes `body`, and the pointer is `pointer`. A tag with dots also shows the **Tooltip** (Menu card): the full name, then "Click for the size and colors." in the body. A short-name tag shows no Tooltip: its name is already there.
- **Open:** a click, a tap, or Enter or Space on a focused tag opens the **paper tag** in its place, below the Piece; the small tag is hidden while it is open, and the thread runs from the corner dot to the paper tag's hole. One paper tag is open at a time: opening another closes the first. Opening is not an Undo step and changes neither the Selection nor the tool.
- **The paper tag:** `--schema-card-width` (236px) wide, `elevated` fill, a 1px `line-strong` edge, `radius-lg` corners except the top-right one, which is **cut** at 45° by `--schema-card-cut` (20px), with an 8px **hole** (`--schema-card-hole`, a 1px `line-strong` ring, the canvas showing through) centred 18px in from the top and right. Flat, with hairlines: no shadow. Padding 12 14 14, rows 8px apart:
  1. `schema` (`meta-tiny`, `muted`, lowercased by style).
  2. The **name**, Inter 600 14/20 (`title`'s weight at 14), up to two lines, then an ellipsis; its right edge stops 46px short of the tag's, clear of the hole. The full name is the paper tag's accessible name.
  3. Two `meta-small` lines in `muted`: the size, "11 × 11 beads · ≈ 18 × 14 mm" (the Piece's rectangle in beads, and its Estimated size with the Canvas's Bead, as the Frame panel works it out), then up to five overlapping 10px swatches (`radius-xs`, 4px overlap, the Palette's order) and "96 beads · 3 colors" (the Schema's beads and its colors, counted as Beads needed counts them).
  4. The actions, pushed to the bottom, 8px apart: **Rename** (`pencil`; the secondary Button at 28px) opens the same name editor Name Piece opens, filled with this name, for this Schema; **Frame** (`frame`; the primary Button at 28px, the region's one accent) frames this Schema as the Context bar's Frame does with the Piece selected: the same snap, refusals, Message and one Undo step; then the close button (`close`, 28px, no fill, `muted`, at the far right), named "Close".
- **Closing:** the close button, Escape, a press outside the paper tag (on the canvas, it also does what the tool does there), or the Schema being framed, erased or losing its name. Focus returns to the tag when the close button or Escape closed it.
- **Live:** while open, the details follow the Schema: painting into it or erasing part of it updates the size and counts; a rename updates the name, and the tag switches between name and dots by the rule.
- **Room:** the tag and the paper tag are kept inside the canvas box. Where the tag would cross the box's right edge, it hangs from the bottom-left corner instead, turned 10° anticlockwise, the thread curving out to the left. Where the paper tag has no room below the Piece, it opens above it, hanging from the same corner with the thread going up to its hole. A Piece whose corner is outside the canvas box shows no tag.
- **Over the canvas:** tags and the paper tag sit above the beads, the Selection and the Frame line, at `z-canvas-overlay`, under the Context bar, the Dock and the popovers (StackingOrder card). A press in a tag's hit box goes to the tag, not to the tool under it, as the Frame's handles do; a stroke or drag that started on the canvas passes over tags without opening them. Hit box: the tag's own box on a fine pointer, at least `touch-target` (44px) square centred on it on a coarse one.
- **Exports:** never in the PNG or PDF; they print the Frame only.
- **Keyboard:** the tags are one Tab stop ("Schema names", after the canvas), in reading order (top to bottom, then left to right, by the Piece's corner); the arrow keys move between them, Enter or Space opens, Escape closes. Focus shows the 2px `focus-ring` round the tag, following its turn.
- **Screen readers:** each tag is a button named "{name}, show details", `aria-expanded` while its paper tag is open; the paper tag is a non-modal dialog named by the full name; its rows are read in order.

## Themes

| | Tag | Thread and dot | Paper tag |
|---|---|---|---|
| Light | `ink` fill, `canvas` text and dots; hover `body` | `muted` thread, `ink` dot | `elevated`, 1px `line-strong` |
| Dark | `ink` (light) fill, `canvas` (dark) text and dots; hover `body` | the same tokens | `elevated`, 1px `line-strong` |
| Contrast | `ink` fill, `canvas` text | `ink` thread at 1px | `elevated`, 2px `line-strong` (`--border-emphasis`) |

The tag is drawn by the page (HTML over the canvas), not by the canvas renderer, so it takes the page's tokens, not the canvas's `ProjectTheme` (DESIGN.md §4).

## Values

`--schema-tag-height` (22px), `--schema-tag-end` (8px), `--schema-tag-hole` (3.2px), `--schema-tag-tilt` (10deg), `--schema-tag-drop` (24px), `--schema-tag-name` (Inter 600 11/22), `--schema-card-width` (236px), `--schema-card-cut` (20px), `--schema-card-hole` (8px), in `bundle.css` and `src/styles/design-values.css`. The 5-character rule is a constant in the code, not a CSS value.

## Copy

"{name}, show details", "Click for the size and colors.", `schema`, "{w} × {h} beads · ≈ {x} × {y} mm", "{n} beads · {n} colors", Rename, Frame, Close, and the Tab stop's name "Schema names": `writing.md`, Schema tag copy (ticket 0721).

## As built

Not built yet: until ticket 0721 the app draws the name as DM Mono 600 text in the Frame's line color under the Piece's left edge (the canvas renderer).
