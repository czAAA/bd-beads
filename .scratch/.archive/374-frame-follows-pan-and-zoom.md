# 374: The Frame and rulers keep following the pattern when I zoom or move the canvas

**What to build:** After a Frame press (Set Frame) or a refused press in the Frame margin, zooming or moving the canvas could leave the Frame outline and rulers where they were while the pattern moved, so they detached from it.

Cause: the margin outline's watcher cancelled every animation frame waiting to draw, but `oncePerFrame` still counted its frame as queued, so every later redraw request was dropped. Unmount already cancels pending frames; the watcher's cancel was a stray copy.

**Blocked by:** None (can start immediately)

**Status:** done

- [x] A Frame press while a draw is waiting does not stop later zoom and scroll redraws
