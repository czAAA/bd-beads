# 122: Framing drag in peyote and at 250×250, and scrolling a 250×250 Pattern, are below the floor

**What to build:** Three numbers the performance plan (ADR 0018) left under the floor of 30 fps at 4× CPU slowdown, recorded in tickets 104, 108 and 111 and tracked nowhere until now (`npm run perf`, headless Chromium, production build):

- **Convert image framing drag in peyote:** 21–23 fps at 60×90 and 100×100 (loom and brick stitch are 43–50). Rounded beads are bitmap blits, about 1.5–3 µs each, and the lattice is up to 12,000 beads redrawn per pointer move. Ideas: redraw only the beads whose color changed since the last frame (and the neighbours nested over them), blit at whole device pixels so the blit takes the unscaled fast path.
- **Framing drag at 250×250:** 6–9 fps in every Technique (62,500 frame beads redrawn per move); at 70×250 loom and brick stitch are 30, peyote 17. The same idea helps; a coarser look while the picture is moving (larger beads, no rims) is the fallback.
- **Scrolling a 250×250 Pattern:** 29 fps at 4× (60 at 6×), against 54 fps at 70×250. The whole Pattern is inside the drawing window at its fit zoom, so nothing is redrawn while scrolling; the cost is the page's own layout and compositing of two large canvases. Profile it before guessing.

Keep the look identical (the visual checks hold that), the stored format untouched, and "what is inside the frame is exactly the Pattern that will be created" true at rest (ADR 0010).

**Blocked by:** None

**Status:** done

- [x] Framing drag in peyote at 60×90 and 100×100 holds at least 30 fps at 4×, measured with `PERF_TECHNIQUES=peyote npm run perf`
- [x] Framing drag at 250×250 is measured again and either meets the floor or the remaining gap and its reason are written here
- [x] Scrolling a 250×250 Pattern holds at least 30 fps at 4×, or the profile that shows why it cannot is written here
- [x] The visual checks and the framing tests still pass

## Resolution

`PERF_SLOWDOWNS=4`, production build:

| | before | after |
|---|---|---|
| framing drag, peyote 60×90 / 100×100 | 21 / 19 fps | 60 / 60 fps |
| framing drag, 250×250 (loom, peyote, brick) | 6–9 fps | 60 fps |
| framing drag, 60×90 and 100×100 loom and brick stitch | 40–45 fps | 38–45 fps (real look kept) |
| scroll, 250×250 | 28 fps | 60 fps |

- **Profile of the framing drag** (peyote 100×100): about 80% of the main thread was `drawImage`, one blit per rounded bead. Blitting at whole device pixels and using `ImageBitmap` sprites made no difference to the frame rate; redrawing only changed beads (and the neighbours nested over them) would have drawn 70% or more of the beads again, since only about 8% of beads change colour per move but each drags its 8 neighbours with it. So the fallback the ticket names was taken: while the picture moves, a block too big to draw bead by bead (`usesDraftLook`: beads × cost > 15,000, a rounded bead costing three) is drawn by `draftRenderer.ts` as one flat pixel per bead stretched in a single blit (half-bead row shifts kept, rims, rounding and brick seams dropped). At rest, and for Create, the beads are drawn by the Pattern renderer as ever.
- **Profile of the scroll**: the cost was not compositing. A 250×250 Pattern at its fit zoom is 1500 px tall, so the drawing window (screen plus 160 px) ran out on the side clamped to the Pattern's edge and the whole window was drawn again every few wheel clicks. A Pattern whose bitmap is at most 10 million device pixels is now held whole, so scrolling draws nothing.
