# 307: The Convert image picture can be dragged by touch and pen

**What to build:** While framing a Convert image, the picture is moved by dragging the frame box, but `ConvertImageFrame.vue` listens only for `@mousedown.left` plus a window `mousemove`/`mouseup` (lines ~320–351). Framing is reachable from the phone layout (`PhoneSheets`), where there is no mouse, so on a phone or iPad the picture likely can't be moved at all. Switch the drag to pointer events (`pointerdown` with pointer capture, `pointermove`, `pointerup`/`pointercancel`), so mouse, touch and Apple Pencil all drag the same way, and stop the page or canvas from panning while the frame is dragged (`touch-action: none` on the box). The existing 150ms settle-after-pause behaviour and the live versus resting preview stay exactly as they are. Found in the architecture review (bug 3; candidate E1 later moves the framing logic out of the SFC).

**Blocked by:** None (can start immediately).

**Status:** ready-for-agent

- [ ] A failing test first drives a touch (`pointerType: 'touch'`) drag on the frame box and shows the pan changing; it passes after the fix
- [ ] Mouse, touch and pen drags move the picture the same distance for the same pointer movement
- [ ] A second finger or a `pointercancel` ends the drag cleanly, and the preview settles as it does after a mouse release
- [ ] The page and canvas don't scroll or pan while the frame is being dragged by touch
- [ ] Existing ConvertImageFrame tests still pass; the visual check is unchanged
