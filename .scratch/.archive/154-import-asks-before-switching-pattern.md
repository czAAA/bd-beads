# 154: Import asks before switching to the imported Pattern

**What to build:** Today an import goes straight into the library and the library decides what to open, with no message. Instead, when a Pattern is open, importing shows a modal asking whether to switch from the current Pattern to the imported one. The modal also tells the person that their current progress is saved. The library saves itself as it changes (see the Pattern library entry in CONTEXT.md and [ADR 0012](../docs/adr/0012-saving-follows-the-pattern-library.md)), so in the normal case the message is just the reassurance. If the last save did not get through (the browser's storage is full), the modal instead says the current Pattern is not saved and offers to save it first; the switch is not offered until that save succeeds or the person chooses to switch anyway. Confirming opens the imported Pattern. Declining still imports it into the library and keeps the current Pattern open, exactly as importing behaves today.

**Blocked by:** None (can start immediately)

**Status:** done

- [x] With a Pattern open, importing a Pattern file shows a confirmation modal before anything is opened; nothing changes on screen until the person answers
- [x] The modal says the current Pattern's progress is saved and names the Pattern being left and the one being opened; when several Patterns are imported at once it says how many came in and which one would open
- [x] "Switch" opens the imported Pattern; "Keep current" imports into the library and leaves the current Pattern open (today's behaviour); Escape counts as "Keep current"
- [x] The imported Pattern is added to the library in both cases; nothing is ever overwritten (a taken id still comes in under a fresh id)
- [x] If the current Pattern has an unsaved change (a failed save), the modal says so and offers a Save action; if the save also fails it shows the storage-full error already used in the top bar and does not claim the Pattern is saved
- [x] With no Pattern open, importing behaves as today with no modal
- [x] Opening a shared QR link is unchanged: scanning a code is itself the request to look at it (see the existing share-link handling)
- [x] Both import controls (single Pattern file and library file) use the same modal, and it reuses the app's existing confirmation modal, following DESIGN.md in both themes, with EN and RU copy
- [x] Undo and Redo history and the clipboard behave as on any other Pattern switch ([ADR 0016](../docs/adr/0016-clipboard-survives-pattern-and-tool-switches.md))
- [x] Tests cover switch, keep current, Escape, multiple Patterns, the failed-save case, the no-Pattern-open case, and that the library gains the imported Pattern in every case
- [x] CONTEXT.md is updated to describe the confirmation on import
