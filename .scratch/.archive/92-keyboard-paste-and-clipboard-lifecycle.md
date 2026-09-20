# 92: Keyboard paste (Ctrl/Cmd+V) and revised clipboard lifecycle

**What to build:** `Ctrl/Cmd+V` pastes the clipboard's block at the cell currently under the pointer — the same target and Mirror-strip behavior as a Select-tool click — and is a no-op if the pointer isn't over the grid. The clipboard's lifecycle changes: it now clears only when a new Copy replaces it or a new Selection is made. It is no longer cleared by switching tools, switching Patterns, or cancelling (Escape/right-click). Switching away from Select, or cancelling, instead just hides the visible projection via a "dismissed" flag — the projection doesn't reappear on the next hover until a new Copy or a new Selection re-arms it, and only Select ever shows the live preview.

**Blocked by:** 86 (Table-driven keyboard-shortcut dispatcher)

**Status:** done

- [ ] `Ctrl/Cmd+V` pastes at the pointer's current cell, matching click-to-paste's targeting and Mirror-strip stamping
- [ ] `Ctrl/Cmd+V` is a no-op when the pointer isn't over the grid
- [ ] `Ctrl/Cmd+V` works while Paint, Fill, Select, or Erase is the active tool
- [ ] Switching tools no longer clears the clipboard; only the visible projection stops
- [ ] Switching Patterns no longer clears the clipboard (it survives across Patterns; Undo/Redo history and Selection still reset as before)
- [ ] Escape and right-click no longer clear the clipboard; they set a "dismissed" flag so the projection doesn't reappear until a new Copy or a new Selection
- [ ] CONTEXT.md's Copy and Paste entries are rewritten to describe the new clearing rules
- [ ] An ADR records the deliberate break from Undo/Redo/Selection's shared "resets on Pattern switch" rule
