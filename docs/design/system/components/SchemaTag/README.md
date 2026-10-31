# SchemaTag

The name of an unframed Schema (a named Piece on the Canvas, ADR 0050) as a luggage tag standing above the Piece's top-left corner, the Piece outlined by a thin border. The name is written on the tag, cut short by an ellipsis where it is too long, and a click or tap opens it into a paper tag with the Schema's details. It replaces the name drawn as DM Mono text under the beads. First approved on the claude.ai canvas "Schema name tag" (variant B, Hang tag) and built by ticket 0721; reworked on the canvas "Schema tag redesign" (2026-10-30) and built by ticket 0733: bigger, fixed to one corner, no thread, and the border.

- **What carries one:** every unframed Schema on the Canvas, one tag each. A framed Schema has none: its name is the Frame's, in the margin sheet's title block (MarginSheet card). A Frame that is removed leaves its Schema on the Canvas, and its tag comes back. A plain Piece (no name) has none.
- **The name:** written on the tag in full where it fits; the tag grows with it up to `--schema-tag-max-width` (184px), and a longer name ends in an **ellipsis**.
- **Where it stands:** above the Piece's **top-left corner**, its left edge on the left edge of the Piece's box (the Piece's rectangle, outside the beads by the Piece outset) and its foot `--schema-tag-gap` (4px) above it. Always that corner: it never moves to another one near the canvas box's edge. It moves with the Piece as the canvas is panned or zoomed, and the canvas box clips it as it clips the Piece. It stands straight: no thread, no tilt.
- **The border:** every unframed Schema's box is outlined, 1px `muted` with `radius-sm` corners, over the Piece's own `pieceLine` rectangle, so a named Piece reads as one marked object. A plain Piece has no border and no tag.
- **The tag:** `--schema-tag-height` (28px) tall, filled `ink`. Its left end is cut on both corners like a luggage tag (`--schema-tag-end`, 9px), with a 6px **hole** (`--schema-tag-hole`) centred 9px in from the end that shows the canvas through it; the right end has `radius-sm` corners. The name in `canvas`, Inter 600 13/28 (`--schema-tag-name`), padded 17px at the left (the end plus 8px) and 12px at the right.
- **Size:** the tag and border are measured in screen pixels and never scale with the zoom, so a tag reads the same at 25% as at 400%. At a far zoom-out the tag can be larger than its Piece; it still stands on the corner.
- **Hover** (fine pointer): its fill becomes `body` (`--duration-fast`, `--ease-out`; none under reduced motion), and the pointer is `pointer`. A tag whose name is cut short also shows the **Tooltip** (Menu card): the full name, then "Click for the size and colors." in the body. A tag whose name fits shows no Tooltip: its name is already there.
- **Open:** a click, a tap, or Enter or Space on a focused tag opens the **paper tag** in its place: its top-left corner where the tag's is, down over the Piece. The small tag is hidden while it is open. One paper tag is open at a time: opening another closes the first. Opening is not an Undo step and changes neither the Selection nor the tool.
- **The paper tag:** `--schema-card-width` (236px) wide, `elevated` fill, a 1px `line-strong` edge, `radius-lg` corners except the top-right one, which is **cut** at 45° by `--schema-card-cut` (20px), with an 8px **hole** (`--schema-card-hole`, a 1px `line-strong` ring, the canvas showing through) centred 18px in from the top and right. Flat, with hairlines: no shadow. Padding 12 14 14, rows 8px apart:
  1. `schema` (`meta-tiny`, `muted`, lowercased by style).
  2. The **name**, Inter 600 14/20 (`title`'s weight at 14), up to two lines, then an ellipsis; its right edge stops 46px short of the tag's, clear of the hole. The full name is the paper tag's accessible name.
  3. Two `meta-small` lines in `muted`: the size, "11 × 11 beads · ≈ 18 × 14 mm" (the Piece's rectangle in beads, and its Estimated size with the Canvas's Bead, as the Frame panel works it out), then up to five overlapping 10px swatches (`radius-xs`, 4px overlap, the Palette's order) and "96 beads · 3 colors" (the Schema's beads and its colors, counted as Beads needed counts them).
  4. The actions, pushed to the bottom, 8px apart: **Rename** (`pencil`; the secondary Button at 28px) opens the same name editor Name Piece opens, filled with this name, for this Schema; **Frame** (`frame`; the primary Button at 28px, the region's one accent) frames this Schema as the Context bar's Frame does with the Piece selected: the same snap, refusals, Message and one Undo step; then the close button (`close`, 28px, no fill, `muted`, at the far right), named "Close".
- **Closing:** the close button, Escape, a press outside the paper tag (on the canvas, it also does what the tool does there), or the Schema being framed, erased or losing its name. Focus returns to the tag when the close button or Escape closed it.
- **Live:** while open, the details follow the Schema: painting into it or erasing part of it updates the size and counts; a rename updates the name, and the tag's ellipsis and Tooltip follow its length.
- **Room:** the tag stays on its corner and is clipped by the canvas box like the Piece; it shows while the Piece or the tag is in view. The paper tag is kept 8px inside the canvas box; where it has no room below, it opens upwards, its bottom edge on the tag's foot. A Piece whose corner is outside the canvas box shows no tag.
- **Over the canvas:** tags and the paper tag sit above the beads, the Selection and the Frame line, at `z-canvas-overlay`, under the Context bar, the Dock and the popovers (StackingOrder card). A press in a tag's hit box goes to the tag, not to the tool under it, as the Frame's handles do; a stroke or drag that started on the canvas passes over tags without opening them. Hit box: the tag's own box on a fine pointer, at least `touch-target` (44px) square centred on it on a coarse one.
- **Exports:** never in the PNG or PDF; they print the Frame only.
- **Keyboard:** the tags are one Tab stop ("Schema names", after the canvas), in reading order (top to bottom, then left to right, by the tag's place); the arrow keys move between them, Enter or Space opens, Escape closes. Focus shows the 2px `focus-ring` round the tag.
- **Screen readers:** each tag is a button named "{name}, show details", `aria-expanded` while its paper tag is open; the paper tag is a non-modal dialog named by the full name; its rows are read in order.

## Themes

| | Tag | Border | Paper tag |
|---|---|---|---|
| Light | `ink` fill, `canvas` text; hover `body` | 1px `muted` | `elevated`, 1px `line-strong` |
| Dark | `ink` (light) fill, `canvas` (dark) text; hover `body` | 1px `muted` | `elevated`, 1px `line-strong` |
| Contrast | `ink` fill, `canvas` text | 1px `ink` | `elevated`, 2px `line-strong` (`--border-emphasis`) |

The tag and border are drawn by the page (HTML over the canvas), not by the canvas renderer, so it takes the page's tokens, not the canvas's `ProjectTheme` (DESIGN.md §4).

## Values

`--schema-tag-height` (28px), `--schema-tag-end` (9px), `--schema-tag-hole` (6px), `--schema-tag-gap` (4px), `--schema-tag-max-width` (184px), `--schema-tag-name` (Inter 600 13/28), `--schema-card-width` (236px), `--schema-card-cut` (20px), `--schema-card-hole` (8px), `--schema-card-min-height` (160px), `--schema-card-name` (Inter 600 14/20), `--schema-card-name-inset` (46px), in `bundle.css` and `src/styles/design-values.css`. Whether a name is cut short is measured on the tag as laid out, not counted.

## Copy

"{name}, show details", "Click for the size and colors.", `schema`, "{w} × {h} beads · ≈ {x} × {y} mm", "{n} beads · {n} colors", Rename, Frame, Close, and the Tab stop's name "Schema names": `writing.md`, Schema tag copy (ticket 0721).

## As built

Built by ticket 0721 as `SchemaTags.vue` (`src/components/canvas/`), reworked by ticket 0733, HTML laid over the canvas box after the canvas, before the Tool pill; the canvas renderer no longer draws an unframed Schema's name. The surface reports each unframed Schema's box on screen (its rectangle, the Piece outset included) as it pans and zooms, and the tags are placed from it (`schemaTagPlacement.ts`); the rules (which Schemas carry a tag, the paper tag's counts) are `domain/schemaTags.ts`. Where it differs from the card above, and why:

- **The press target is a button round the cut shape:** the tag's cut corners and hole are a `clip-path` and a mask, which would also cut a focus ring and a finger's larger hit area, so the button holding the shape carries both. The 44px hit area is the button's `::before` on a coarse pointer.
- **The paper tag's place:** it is kept 8px inside the canvas box, and is hidden, as the tag is, while neither the Piece nor its tag is in view.
- **Focus:** opening moves focus into the paper tag (the dialog itself), so Tab reaches Rename, Frame and Close; while it is open it is a layer of the overlay registry, so the app's keyboard shortcuts wait until Escape or a press closes it. A press outside closes it and still goes on (on the canvas, the tool works there): the registry's `outside: 'through'`.
- **The actions:** the Buttons are 28px with 8px sides and a 4px icon gap, so Rename, Frame and Close share one row in English; a longer language wraps Close onto a row of its own. Frame is left out on a Custom frame, as the Selection bar leaves it out.
- **The swatches** carry the 1px `swatch-edge` ring, so a light color reads on the paper.
- **Following its Schema:** an open paper tag follows the bead its name is kept on, or the name should that bead be erased, and closes once the Schema is framed, erased or unnamed.
