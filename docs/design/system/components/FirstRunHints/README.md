# FirstRunHints

Hand-drawn notes over an empty Project that teach the way to a first Pattern: **draw, select, frame, export**. The four controls on that path are ringed in `accent`; every note is a quiet `muted` note with a hand-drawn arrow, like the Homepage's drawn layer. Approved on the claude.ai canvas "First-run canvas hints" (variant A, hand-drawn notes; light, dark and Russian, desktop and phone), https://claude.ai/artifact/AzASFSn3Fri1K1Jsr9SsMp.

## When they show

- **Whenever the open Project has no beads**, on every empty Project (not only the first one, nothing remembered on the device), in every theme. The same rule as the CanvasHint, which shows with them.
- **They go with the first bead**, all at once, fading out over `--duration-fast` (at once under reduced motion). They come back whenever the Project is emptied again (Clear all beads, or the last bead erased).
- After the first bead the only hint left is the Progress bar's existing no-Frame line, "Select to set a Frame" (ProgressBar card).
- Not with no Project open (EmptyCanvas card), not inside Convert image, never on exports. There is no dismiss button.

## The four steps

Each step is a ring on its control and a note pointing at it.

| Step | Control it rings | Note (English) |
|---|---|---|
| 1 | the Paint tile (Tool pill) | 1 · pick Paint and draw anywhere |
| 2 | the Select tile (Tool pill) | 2 · pick Select and drag a box round your drawing |
| 3 | the Frame button (Canvas strip) | 3 · make a Frame round your drawing, / then set its name, size and Bead here |
| 4 | the Export button (Canvas strip) | 4 · export a picture / or a printable chart |

- **Ring:** `0 0 0 2px <what is behind the control>, 0 0 0 4px accent` (`--hint-ring-gap`, `--hint-ring-width`): the pill's fill round a tile, the strip's `box` round a strip button. The control keeps its own look under it (Paint stays the active tile). The ring is the only accent on the path's controls.
- Step 3's note names the strip's Frame button because the Selection bar's Frame (ContextBar card) only exists once there is a Selection, by which time the notes are gone. The Frame panel the button opens holds the name, size and Bead.

## Quiet notes

Smaller notes for the controls a person meets next. In English:

- **Menu** (Canvas strip): "open, save, / preferences, / language…"
- **Project** (Canvas strip): "your Project: its name, maker, / Technique, Bead and background"
- **Mirror** tile: "Mirror: paint both sides of an axis at once"
- **Colour** tile: "colors and your Palette"

## Welcome

Centred on the drawing area, under the CanvasHint line:

- The X1 mark (60px, `accent`, the logo's rules) and "openbeads" in Instrument Serif italic 64px (`--hint-wordmark`), 14px apart. The wordmark is `muted` here, not `ink`: the welcome is part of the quiet drawn layer, not the Brand (CanvasStrip card) (deliberate difference).
- 18px under it, in Instrument Serif italic 24px (`--hint-welcome`), `muted`: "your first Pattern in four steps:", and on the next line "draw → select → frame → export" in `accent-strong`, the one piece of accent text in the layer.
- No buttons: opening a file, Convert image and Keyboard shortcuts stay in Menu.

## Look

- **Notes:** the `note` face (Instrument Serif italic, Source Serif 4 for Cyrillic) in `muted`, sentence case, no full stop. Step notes 22px (`--hint-step`), quiet notes 19px (`--hint-note`), line height 1.15. Lines break where the table shows "/"; in other languages they wrap rather than overflow.
- **No backing:** nothing is drawn behind a note; the Canvas's Position marks show through.
- **Arrows:** one hand-drawn curve from the note to 6px off the control's edge, `muted`, round caps and joins, an open head of two 6px strokes. 1.5px for a step (`--hint-step-arrow`), 1.4px for a quiet note (`--hint-arrow`).
- **Colour:** `muted` and `accent-strong` take the theme's values: yellow accent in dark, no shadows; high contrast uses its own tokens. On a Canvas background where `muted` is under 4.5:1 the notes take `body` (CanvasBackground card).

## Place

Reference: MacBook Air (1440 × 900), the Tool pill docked at the bottom.

- Notes sit 40 to 110px from their control on the drawing-area side, never over a control, the CanvasHint line, the welcome or each other. Step 3's note sits right of the Frame button, under the strip; step 4's is right-aligned under Export; the Menu note runs down the left edge; the Project note sits under the Project button; steps 1 and 2 sit above the pill, Paint's to the left, Select's to the right; Mirror's and the colour note sit above and right of their tiles.
- **The Tool pill moves:** the tile notes (steps 1 and 2, Mirror, colour) follow the pill to whichever edge it is docked at, on the drawing-area side of their tiles.
- **Not enough room:** the quiet notes drop first, in the order Project, Menu, Mirror, colour; the four steps and the welcome always show.
- They sit on the canvas overlay layer (`z-canvas-overlay`), under the Tool pill, the strip and every popover, and do not move with the canvas.

## Phone (30rem and under)

- Only the four step notes and the welcome (mark 40px, wordmark 44px, the steps line 20px). No quiet notes, no key chips, no CanvasHint line.
- Shorter notes, 20px: "1 · pick Paint and draw", "2 · pick Select, drag a box", "3 · make a Frame round it, / then set it up here", "4 · export, at the end / of this strip".
- Export sits off the end of the strip, which scrolls sideways (CanvasStrip card), so step 4's arrow points at the strip's right edge and its ring shows once Export is scrolled into view.

## Accessibility

- The whole layer, rings included, is decoration: `aria-hidden`, `pointer-events: none`, so the first press on the canvas paints the first bead. The same steps are in Keyboard shortcuts and in each control's Tooltip.
- No keyboard stop, nothing to dismiss.

## As built (ticket 0725)

- **Phone values:** `--hint-step-phone` (20px), `--hint-welcome-phone` (20px) and `--hint-wordmark-phone` (44px) carry the Phone section's sizes; the mark is 40px there.
- **Placing:** each note tries distances of 40 to 110px from its control (a quiet note up to 170px) and slides along its edge, away from the control, before it gives up; it may not cover the Tool pill, the CanvasHint line, the welcome, another note or another note's arrow, and its arrow may not cross any of them. Each arrow tries a bow to either side, then a flatter one. Two orders are tried, steps first and a staircase (colour, Mirror, then step 2, so step 2's note sits above theirs), and the one that places most notes with every step in a free place wins.
- **Ring:** a strip button is lifted to `z-canvas-overlay` while ringed so the ring's foot shows over the drawing area; the strip's scrolling controls keep the ring's 4px inside them so Export's ring is not cut.
- A step note is at most 22rem wide and wraps; the wordmark's -0.6px tracking is twice `tracking-brand`.

The copy in every language is in `writing.md`, "First-run hints copy".

Hand-written from the approved canvas (2026-10-30, ticket 0725); static rendition.
