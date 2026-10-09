# 357: A pinch to zoom no longer draws a bead under the first finger

**What to build:** on a touch screen (found on iPad), starting a two-finger pinch must not leave a bead painted where the first finger landed. Today the first finger paints on contact, and when the second finger lands the pinch keeps that bead as its own undo step, so every zoom or pan gesture starts with a stray bead.

Cause (found by reading the code; the pinch is the one place that knows a one-finger press was the start of a gesture): the pinch ends the first finger's stroke instead of dropping it. The fix taken in the first pass is to cancel the stroke: put the stroke's starting state back, record no undo step, end any Select press, and clear the stroke mode.

Known limits, to decide in this ticket or split out:

- The bead still shows for an instant before the second finger lands, since touch paints on contact. Removing the flash means delaying touch paint until the finger moves or lifts, a bigger behaviour change.
- The Fill tool commits one undoable fill on contact (it is not a stroke), so a pinch started on Fill still leaves that fill. Making it cancellable needs the same take-back for a Fill.

**Blocked by:** None (can start immediately)

**Status:** ready-for-agent

- [ ] A failing test reproduces it: a paint stroke begun by one finger, then cancelled by the pinch, leaves the bead as it was and adds no undo step
- [ ] With Paint or Eraser, putting a second finger down within a pinch leaves no bead changed and no undo step, and the Undo button state is unchanged
- [ ] A one-finger stroke, tap and drag are unchanged, including its single undo step and single save
- [ ] The Select tool's press is ended, not left stretching, when a pinch starts
- [ ] Decided and noted in the ticket: what happens for Fill and for the instant flash of the first bead
- [ ] The ticket is archived in the same change
