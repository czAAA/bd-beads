# Saving follows the Project library instead of sitting on the edit path

**Status: accepted.** Tickets 55, 115, 119.

[ADR 0001](0001-local-only-persistence.md) puts the Project library in localStorage. This decides when it is written and what happens when the write is refused.

The Project library, which Project is open, and persistence live together in `useProjectLibrary`, which persists through the library-store service ([ADR 0020](0020-module-boundaries-and-a-services-layer.md)). Every change goes through it, and every undoable one through Edit ([ADR 0036](0036-every-undoable-change-goes-through-edit.md)); nothing else touches storage. A save writes the whole library from memory: the in-memory Projects are the source of truth, so a save never reads storage back to merge.

- **Saving is funnelled, not watched.** A `watch` would fire on every cell of a dragged stroke and make deferral load-bearing for correctness. Routed through one commit point, a forgotten flush only delays: the change is still in memory, on screen and undoable, and the next save carries it.
- **One edit defers its save: a dragged Paint or Eraser stroke.** The stroke's end writes once; `pagehide` and the editor's teardown flush too, so an edit is never both unsaved and unrecoverable.
- **A refused write is visible.** localStorage throws when a write doesn't fit; the library catches it, keeps the change pending for the next save to retry, and raises `saveFailed`, shown until a save gets through as a "couldn't save" notice in the notice row at the top of the screen, and on the save box's (or the phone's Project sheet's) save mark. The notice is about the whole library, not the open Project, so it shows whether or not a Project is open.
- **Save is reassurance, not a schedule.** The Save control (Ctrl/⌘+S) writes the whole library at once and says whether storage took it, and also downloads the open Project as a Project file (on iPhone and iPad, offers it to the share sheet). The file goes out even if the write was refused, since it is then the only copy.

A "storage nearly full" warning is deliberately not built: the compact encoding ([ADR 0009](0009-compact-grid-encoding.md)) puts that wall years away.

**Considered options**: debouncing every save behind a timer (rejected: a debounce that drops the last write is the fragility the funnel avoids); one storage key per Project (rejected: reduces write amplification but not size; **revisit if painting feels sticky**).
