# 120: Manual performance pass on an iPad Air 13″

**What to check:** The last target of ticket 108 that a headless browser cannot answer: on an iPad Air 13″, hover (Apple Pencil hover, if it has it), paint, Fill, Selection drag, pan and pinch-zoom hold 60 fps at 250×250, and 70×250 feels as smooth. Everything measured so far is a production build in headless Chromium with the CPU slowed 4× and 6×, which stands in for a slow device and says nothing about an iPad's GPU or Safari (ADR 0018's iPad Safari concerns: canvas size limits, no canvas filters). Also look at what Safari specifically might get wrong: bead edges crisp at every zoom on the Retina display, a touch or Pencil stroke that paints without scrolling the page, Space-drag pan's equivalent, Convert image framing at 60×90 and 100×100, and how long opening a 250×250 Pattern takes.

**How:** open the deployed app (or `npm run preview` on the LAN) on the iPad, create a 250×250 Pattern (New Pattern, size in beads), and go through the list above; `npm run perf` on a laptop gives the numbers to compare with. Write what was seen into this ticket.

**Blocked by:** None (108 is done)

**Status:** ready-for-human

- [ ] Hover, paint and pan/zoom at 250×250 on an iPad Air 13″ feel like 60 fps, or the shortfall is written down here
- [ ] A Pencil or finger stroke paints beads and does not scroll the page
- [ ] Bead edges are crisp at 25%, 100% and 300% on the Retina display
- [ ] Convert image framing at 60×90 and 100×100 is smooth; 250×250 is noted
- [ ] Opening a 250×250 Pattern takes about as long as the perf check says (a fraction of a second)
