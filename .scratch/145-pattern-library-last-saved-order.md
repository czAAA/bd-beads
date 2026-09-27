# 145: Pattern library remembers last-saved order

**What to build:** Saving a Pattern records when it was last saved, so the library can list Patterns most recently saved first. Today the Pattern library is a flat set with no ordering (`CONTEXT.md`). Existing stored Patterns keep working: they get a sensible order the first time the app loads them, with no data loss. This is the prefactor for the Saved Patterns box (ticket 147) and changes no visible UI by itself.

**Blocked by:** None (can start immediately)

**Status:** done

- [x] Saving a Pattern (new or existing) moves it to the front of the library's order
- [x] The order persists across reloads and is stored with the Pattern library, following ADR 0012 and ADR 0001
- [x] Patterns saved before this change load unchanged and are given a stable order
- [x] Importing, replacing and removing Patterns keep the order consistent
- [x] `CONTEXT.md`'s Pattern library entry is updated to say it is ordered by last save
- [x] Tests cover save, re-save, remove, import and migration of a pre-existing library

**Done (ticket 145):** each Pattern carries an optional `savedAt`, stamped whenever the library saves it, and the library array is kept in that order (most recently saved first; ties by last edit, then as stored). The field is optional rather than a new stored format, so a library saved before it loads byte-for-byte unchanged (its `updatedAt` stands in) and an older cached build can still read a newer library. Opening a Pattern doesn't reorder; Save moves the open one to the front even with nothing changed; imported Patterns join at the front, most recently edited first.
