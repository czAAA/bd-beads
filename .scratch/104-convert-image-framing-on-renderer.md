# 104: Convert image framing on the renderer

**What to build:** The Convert image framing preview is drawn by the Pattern renderer instead of one DOM element per bead, so dragging the picture under the frame is smooth at the sizes that are slow today (measured before this work: about 50 ms per drag step at 60×90 and 60 ms at 100×100, against a 16 ms budget). The frame outline and its dimming of everything outside stay as they are; only the beads move to a Drawing surface. The old DOM preview is replaced outright (it needs no reference switch: ticket 103's screenshots are the reference), and its tests move with it.

**Approximate colors while dragging.** Reducing the picture to the chosen number of Image colors costs more than the whole frame budget on its own, so while the picture is being dragged the preview keeps the colors it had when the drag started and maps each bead to the nearest of them; when the drag ends (or pauses) it recomputes exactly. At rest the preview, and so the Pattern that Create makes, is exactly what it is today: "what is inside the frame is exactly the Pattern that will be created" (ADR 0010) still holds whenever the picture is not moving. Zooming the picture and changing the color count recompute exactly, as now.

**Blocked by:** 67 (Pattern renderer)

**Status:** ready-for-agent

- [ ] The framing preview draws its beads with the Pattern renderer, for loom, peyote and brick stitch, with the surrounding picture dimmed and the frame outlined as today
- [ ] Dragging the picture stays at the floor target (at least 30 fps at 4× CPU slowdown) at 60×90 and 100×100, measured with ticket 103's performance check; the numbers are recorded in this ticket
- [ ] While dragging, colors come from the palette held since the drag began; when the drag ends the preview recomputes exactly, and the Image colors count shown and the Pattern created match what they were before this change for the same picture, frame, zoom, pan and color count
- [ ] Zooming the picture, changing the color count, and resizing the frame recompute exactly, as before
- [ ] The look matches ticket 103's framing screenshots within tolerance
- [ ] The DOM preview is gone, and its tests (about 18 references to per-bead and per-row elements) are re-expressed at the domain level and against the renderer; no behaviour test is dropped without an equivalent
- [ ] The slow-framing warning on the New Pattern form (ticket 61) is reviewed: kept, retuned to the new measured limits, or removed, with the reason written in this ticket
