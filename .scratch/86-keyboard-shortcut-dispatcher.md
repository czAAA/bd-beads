# 86: Table-driven keyboard-shortcut dispatcher

**What to build:** Refactor App.vue's single `keydown` handler into a table-driven dispatcher (key/modifier combo → action), so every future shortcut is one table entry instead of a growing if/else chain, and the same table can later drive tooltip hints (tickets 87-95) and the shortcuts help overlay (ticket 96). Existing Undo/Redo/Escape behavior must be unchanged.

**Blocked by:** None (can start immediately)

**Status:** ready-for-agent

- [ ] Undo (Ctrl/Cmd+Z), Redo (Ctrl/Cmd+Shift+Z or Ctrl+Y), and Escape behave exactly as before (collapse an expanded Tool group, then back out of Select/Paste/Selection, deferring to an open confirm modal)
- [ ] Shortcuts stay suppressed while typing in a form field (`isTypingInFormField`)
- [ ] A new shortcut can be added as a single table entry (key, modifiers, action, guard) without touching the dispatch function itself
- [ ] No user-visible behavior change
