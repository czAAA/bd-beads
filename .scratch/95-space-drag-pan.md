# 95: Space+drag pans the canvas

**What to build:** Holding `Space` and dragging pans the Pattern's viewport — a pure scroll, no grid-data change — regardless of which tool is active, with a grab/grabbing cursor while held. No-op when the Pattern already fits the viewport.

**Blocked by:** None (can start immediately)

**Status:** ready-for-agent

- [ ] Holding `Space` and dragging scrolls the canvas panel
- [ ] Panning does not paint/fill/erase/select even if the pointer moves over cells while `Space` is held
- [ ] Cursor shows grab (Space held, not dragging) and grabbing (actively dragging)
- [ ] No-op when the Pattern already fits the viewport
- [ ] `Space` is suppressed while typing in a form field (doesn't hijack a space character)
