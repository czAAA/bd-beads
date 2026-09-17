# 55: Take saving off the per-cell edit path

**What to build:** Painting no longer rewrites the whole Pattern library on every cell, and a save that fails is visible instead of silent.

Today every cell painted during a drag re-reads and re-writes every saved Pattern: a full parse of the library, a normalise pass over every Pattern in it, then a synchronous write of the whole thing — once per mousemove. Measured on a 10-Pattern library of ordinary 60×90 Patterns, that is roughly 3ms of JSON work plus a synchronous write of about 1MB, per cell. And if that write exceeds the browser's storage quota it throws where nothing catches it, so the edit is lost with no sign to the user at all.

- **The Pattern library moves behind a composable** that owns the Patterns, which one is open, and persistence.
- **Every Pattern change already funnels through a single place.** That place schedules a save rather than performing one, so a dragged stroke writes once when it ends instead of once per cell. Every other edit — create, remove, import, Delete all, Replace Bead, Undo, Redo — keeps persisting exactly as it does now.
- **A failed save becomes visible**: a "couldn't save" state in the UI, in both languages, instead of an uncaught error.

Deliberately **not** in scope: a proactive "storage nearly full" warning. Ticket 56 moves the ceiling from roughly 50 Patterns to roughly 1,600, which makes a proactive warning a warning about a wall years away. If ticket 56 is dropped or stalls, add the warning here instead — that is the trigger.

**Blocked by:** 54 (retire the rich Mirror flag) — App.vue is substantially smaller once the flag branches are gone, which makes this extraction a much smaller diff

**Status:** ready-for-agent

**Decisions (2026-09-17):**
- Persistence becomes a subscriber to the library rather than a step in the edit path. The in-memory Patterns are already the source of truth; saving should follow them, not gate them.
- Saving is funnelled, not watched. A `watch` over the library would fire on every reactive change, including the timestamp churn of each individual stroke cell, which would make the debounce load-bearing for correctness. Routing through the single existing commit point gives the same can't-forget property with none of that fragility.
- Only this one composable is extracted. The other App.vue slices — editor/history, Mirror settings, Selection and clipboard — come out when a ticket actually needs them, not as a refactor for its own sake. A big-bang restructure of a 1150-line file behind 663 tests is exactly the change that is hard to review and easy to regress.
- Per-Pattern storage keys are deliberately excluded. They reduce write amplification but not total size, and saving on stroke end already removes the per-cell cost. Revisit only if painting still feels sticky afterwards.
- Excalidraw, the closest local-first peer to this app, has an open data-loss issue of exactly this shape (excalidraw/excalidraw#8395): past the quota, saves silently fail and users lose whole boards. Making the failure visible is the minimum fix.

- [ ] A dragged paint or erase stroke writes to storage once, when the stroke ends, rather than once per cell
- [ ] Creating, removing and importing Patterns, plus Delete all, Replace Bead, Undo and Redo, all still persist
- [ ] The Pattern library and its persistence live in one composable that can be unit-tested without mounting the app
- [ ] A storage write that throws leaves a visible "couldn't save" state, in English and Russian
- [ ] Re-opening the app after a reload shows the same Patterns, unchanged
- [ ] Full suite green
