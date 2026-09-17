# 42: Delete all

**What to build:** A Delete all control in the Tools group resets the open Pattern to how it was when first created at its size. Clicking it opens an in-app confirmation modal (Cancel / Delete all; Escape cancels). Confirming empties every cell and clears Row progress (turned off, both Row direction pointers back at the first row), while keeping the Pattern's name, size, Technique, Bead and rotation. It is one undo step, and Undo brings back both the painted grid and the Row progress state.

**Blocked by:** 40

**Status:** ready-for-agent

**Decisions (2026-09-16):**
- Glossary: **Delete all** (RU: Очистить всё) — see CONTEXT.md.
- Unlike other drawing commands it ignores the Row progress lock: clearing progress is part of what it does.
- Confirmation is an in-app modal styled like the app, not the browser's `confirm()`.
- Undo is extended just enough to restore Row progress along with the grid for this command.
- Not affected by Mirror.

- [ ] Delete all appears in the Tools group
- [ ] Clicking it opens a confirmation modal; Cancel or Escape closes it with the Pattern untouched
- [ ] Confirming leaves every cell empty and Row progress off, with both direction pointers at the first row
- [ ] Name, size, Technique, Bead and rotation are unchanged
- [ ] One Undo restores the previous grid and Row progress exactly, including woven rows
- [ ] Modal and button labels are translated
