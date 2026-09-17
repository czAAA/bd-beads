# 49: Copy clears the Selection

**What to build:** After Copy, the Selection's highlighted marquee disappears immediately, the same way it would if you'd right-clicked or pressed Escape with nothing copied. The clipboard stays armed, so the next click still Pastes normally. Copying the same block a second time requires dragging a new Selection over it first, since nothing is left highlighted to copy again.

**Blocked by:** None (can start immediately)

**Status:** ready-for-agent

**Decisions (2026-09-17):**
- Glossary: **Selection** and **Copy** — see CONTEXT.md (already updated).
- Only the Selection clears; the clipboard (`copiedBlock`) is untouched.
- This drops the previous deliberate behavior where the Selection stayed highlighted after Copy specifically so Copy could be repeated on the same block without reselecting — that convenience is intentionally traded away for a Selection that doesn't linger once it's been used.
- Right-click / Escape are otherwise unchanged: with the clipboard armed they still cancel the pending Paste (there's no lingering Selection left to preserve by that point, since Copy already cleared it); with nothing copied they still clear an active Selection.

- [ ] Clicking Copy hides the Selection's highlighted marquee immediately
- [ ] The clipboard still holds the copied block; the next click Pastes it normally
- [ ] Copying the same block again requires dragging a new Selection over it first
- [ ] Right-click / Escape with the clipboard armed still cancels the pending Paste as before
- [ ] Right-click / Escape with nothing copied still clears an active Selection as before
