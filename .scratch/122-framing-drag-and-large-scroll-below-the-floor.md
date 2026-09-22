# 122: Framing drag in peyote and at 250×250, and scrolling a 250×250 Pattern, are below the floor

**What to build:** Three numbers the performance plan (ADR 0018) left under the floor of 30 fps at 4× CPU slowdown, recorded in tickets 104, 108 and 111 and tracked nowhere until now (`npm run perf`, headless Chromium, production build):

- **Convert image framing drag in peyote:** 21–23 fps at 60×90 and 100×100 (loom and brick stitch are 43–50). Rounded beads are bitmap blits, about 1.5–3 µs each, and the lattice is up to 12,000 beads redrawn per pointer move. Ideas: redraw only the beads whose color changed since the last frame (and the neighbours nested over them), blit at whole device pixels so the blit takes the unscaled fast path.
- **Framing drag at 250×250:** 6–9 fps in every Technique (62,500 frame beads redrawn per move); at 70×250 loom and brick stitch are 30, peyote 17. The same idea helps; a coarser look while the picture is moving (larger beads, no rims) is the fallback.
- **Scrolling a 250×250 Pattern:** 29 fps at 4× (60 at 6×), against 54 fps at 70×250. The whole Pattern is inside the drawing window at its fit zoom, so nothing is redrawn while scrolling; the cost is the page's own layout and compositing of two large canvases. Profile it before guessing.

Keep the look identical (the visual checks hold that), the stored format untouched, and "what is inside the frame is exactly the Pattern that will be created" true at rest (ADR 0010).

**Blocked by:** None

**Status:** ready-for-agent

- [ ] Framing drag in peyote at 60×90 and 100×100 holds at least 30 fps at 4×, measured with `PERF_TECHNIQUES=peyote npm run perf`
- [ ] Framing drag at 250×250 is measured again and either meets the floor or the remaining gap and its reason are written here
- [ ] Scrolling a 250×250 Pattern holds at least 30 fps at 4×, or the profile that shows why it cannot is written here
- [ ] The visual checks and the framing tests still pass
