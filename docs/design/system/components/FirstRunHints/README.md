# FirstRunHints

Quiet captions over an empty Project, each beside the control it names, and a welcome that says where Projects are kept. They teach the way to a first Pattern (**draw, select, frame, export**) without arrows: no tip points across the screen, so a first-time user isn't met by a crowd of notes. Approved on the claude.ai canvas "openbeads first-run: decluttered welcome" (variant A, "Captions, not arrows"), https://claude.ai/artifact/WryGs4Rocro7kpRPkDxm6R (ticket 0738). It replaces the hand-drawn notes and arrows of ticket 0725 (canvas "First-run canvas hints", https://claude.ai/artifact/AzASFSn3Fri1K1Jsr9SsMp).

## When they show

- **Whenever the open Project has no beads**, on every empty Project (not only the first one, nothing remembered on the device), in every theme. The same rule as the CanvasHint, which shows with them.
- **They go with the first bead**, all at once, fading out over `--duration-fast` (at once under reduced motion). They come back whenever the Project is emptied again (Clear all beads, or the last bead erased).
- After the first bead the only hint left is the Progress bar's existing no-Frame line, "Select to set a Frame" (ProgressBar card).
- Not with no Project open (EmptyCanvas card), not inside Convert image, never on exports. There is no dismiss button.

## Captions

Each caption sits right beside its control, on the drawing-area side. A caption names what its control holds in the app's own words (the Selection bar's actions, the Mirror bar's Axes, the Menu's items). In English:

| Control | Caption | Look |
|---|---|---|
| Menu (Canvas strip) | new Project, Projects library, language, theme and preferences | quiet |
| Project (Canvas strip) | set up this Project: its name, maker, Technique, Bead and background | quiet |
| Frame (Canvas strip) | frame your drawing: name, size and Bead | quiet, no ring |
| Export (Canvas strip) | export a picture / or a printable chart | step, right-aligned under Export |
| Select tile | select to measure, fill, set a Frame, / copy, paste, rotate or mirror | step |
| Mirror tile | Mirror: left–right, top–bottom or radial | quiet |
| Colour tile | colors and your Palette | quiet |
| Paint tile | none: Paint is already the active tool, and the welcome says "draw" | |

- **Rings:** only Select, Mirror and Export, the controls a newcomer wouldn't guess at: `0 0 0 2px <what is behind the control>, 0 0 0 4px accent` (`--hint-ring-gap`, `--hint-ring-width`), the pill's fill round a tile, the strip's `box` round Export. The control keeps its own look under it.
- **Look:** the `note` face (Instrument Serif italic, Source Serif 4 for Cyrillic), sentence case, no full stop, line height 1.15, nothing drawn behind. A quiet caption is 16px in `muted` (`--hint-note`); a step caption (Select, Export) is 19px in `body` (`--hint-step`). On a Canvas background where `muted` is under 4.5:1 the quiet captions take `body` too (CanvasBackground card).

## Place

Reference: MacBook Air (1440 × 900).

- **Strip captions** sit 8px under their own button, each wrapping in its own column: the room under its button up to the next strip button, at most 192px, so a caption never runs under a neighbour's button. Menu's starts no nearer the edge than 8px; Export's is right-aligned under Export. A quiet strip caption whose column would be under 64px is left out; Frame's and Export's then wrap in 64px.
- **Tile captions** sit 10px off their tile on the drawing-area side (clear of the pill's edge and the ring), centred on the tile. To clear another caption or an obstacle they stack further out (up to 112px), still centred, before they slide along the pill. They follow the Tool pill to whichever edge it is docked at.
- No caption covers another, the Tool pill, the CanvasHint line or the welcome.
- **Not enough room:** the quiet captions drop first, in the order Project, Menu, Mirror, colour; Select, Frame and Export always show.
- They sit on the canvas overlay layer (`z-canvas-overlay`), under the Tool pill, the strip and every popover, and do not move with the canvas. Export is lifted to `z-canvas-overlay` while ringed so its ring's foot shows over the drawing area; the strip's scrolling controls keep the ring's 4px inside them.

## Welcome

Centred on the drawing area, under the CanvasHint line:

- The X1 mark (44px, `accent`, the logo's rules), and 12px under it "openbeads" in Instrument Serif italic 46px (`--hint-wordmark`, -0.6px tracking), `muted`: part of the quiet layer, not the Brand (deliberate difference).
- 16px under it "draw → select → frame → export" in Instrument Serif italic 22px (`--hint-welcome`), `accent-strong`, the one piece of accent text in the layer.
- 24px under it the storage line in Inter 14px (`--hint-storage`), `muted`, at most 36rem wide: "Your Projects are kept in this browser, on this device. / The browser can clear them without warning, so keep a file of the ones you love:".
- 10px under it the way to a Project file, the Project panel's own labels in the CanvasHint's chips (DM Mono on `.hint-chip`) joined by "›": `Project › Export › Project file`.
- No buttons: opening a file, Convert image and Keyboard shortcuts stay in Menu.

## Phone (30rem and under)

- No captions: only the welcome (mark 36px, wordmark 36px, the steps line 18px, the storage line and the path) and the three rings. No CanvasHint line.
- Export sits off the end of the strip, which scrolls sideways (CanvasStrip card); its ring shows once Export is scrolled into view.

## Accessibility

- The whole layer, rings included, is decoration: `aria-hidden`, `pointer-events: none`, so the first press on the canvas paints the first bead. The same help is in Keyboard shortcuts and in each control's Tooltip.
- No keyboard stop, nothing to dismiss.

The copy in every language is in `writing.md`, "First-run hints copy".

Hand-written from the approved canvas (2026-10-31, ticket 0738); static rendition.
