# 50: Paste projects and stamps through Mirror

**What to build:** While a block is armed on the clipboard, hovering over the grid previews it not just under the pointer but at every strip Mirror would mirror it into, honouring the current axis counts and copy mode. Clicking stamps all of those copies at once, as a single undo step. Each copy keeps Paste's own hole rule independently — an empty cell in the block leaves that copy's destination color alone rather than erasing it — and each copy is clipped silently on its own if it reaches past the grid's edge.

Respects the existing `VITE_RICH_MIRROR` flag (ticket 44): with it off, Paste mirrors only across the single fixed center axis, matching how Paint already behaves in that state; with it on, Paste projects across every strip the current axis counts define.

**Blocked by:** 44, 47

**Status:** ready-for-agent

**Decisions (2026-09-17):**
- Glossary: **Paste** and **Mirror** — see CONTEXT.md (already updated), and the amendment note this ticket adds to [ADR 0006](../docs/adr/0006-live-mirror-while-drawing.md).
- Reverses "Paste is unaffected by Mirror" — Paste is now live-mirror-aware like Paint, just stamped as one action instead of built up stroke by stroke.
- Preview and placement always match: the hover ghost shows exactly the copies a click will stamp, never more or less.
- All stamps from one click (original plus every mirrored copy) count as a single undo step, consistent with Delete all (ticket 42) and mirrored Paint strokes.
- Each mirrored copy independently keeps the "holes leave destination alone" rule and independent edge-clipping — copies don't interact with each other, only with the grid underneath them.
- Blocked by 44 (needs the axis-count system Paste projects across) and 47 (reuses the hover-preview geometry "Mirror current" already established).

- [ ] With Mirror off (all axis counts 0), Paste behaves exactly as today: one preview, one stamp
- [ ] With `VITE_RICH_MIRROR` off and the single center axis on, hovering previews the block at both the aimed spot and its one mirrored counterpart; clicking stamps both, as one undo step
- [ ] With `VITE_RICH_MIRROR` on and N axes set, hovering previews the block at every strip; clicking stamps all of them, as one undo step
- [ ] Each stamped copy leaves the block's empty cells as holes (destination color shows through) independently of the others
- [ ] Each stamped copy is clipped independently if it reaches past the grid's edge
- [ ] Copy mode (repeated vs mirrored strips) is honoured in both the preview and the stamp
- [ ] One Undo removes every copy from that click together
- [ ] Right-click / Escape while the preview is showing still cancels the pending Paste as before
