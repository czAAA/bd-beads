# Only the canvas zooms; the browser's page zoom is locked

**Status: accepted.** Ticket 316.

## Context

bd-beads is a drawing tool. The canvas already takes its own pinch and Ctrl/⌘ + wheel and keeps `touch-action: none`, but the rest of the page can still be page-zoomed: a double-tap by finger or Apple Pencil on the iPad, a two-finger pinch off the canvas, or Ctrl + wheel on the desktop resizes the header, Toolbox and Dock, and the layout jumps mid-drawing.

## Decision

- **Page zoom is locked**, **Canvas zoom** is the only zoom. A zoom gesture changes the canvas only when it starts inside the canvas; started anywhere else it does nothing, and one that drifts onto the canvas stays inert.
- Locked in layers: `maximum-scale=1, user-scalable=no` in the viewport meta; `touch-action: manipulation` on the shell (no double-tap zoom); a non-passive `wheel` listener cancelling Ctrl/⌘ + wheel outside the canvas; `gesturestart`/`gesturechange` cancelled outside the canvas, because iOS Safari ignores `user-scalable=no`; while a finger is down they are cancelled inside the canvas too, since the canvas pinches by pointer events and Safari's page zoom on top of it blurs the view and pushes the chrome off screen (ticket 350).
- Keyboard zoom (Ctrl/⌘ + plus, minus, 0) is caught and drives Canvas zoom, as drawing tools such as Excalidraw do. The browser's menu zoom cannot be stopped and is not handled.
- `overscroll-behavior: none` on the page and the scrolling areas (left column, sheets) so nothing moves the page; their own touch-scroll stays.
- The layout does not change: the page already never scrolls and the chrome is already fixed in place.

## Considered options

1. **Leave page zoom to the browser.** Rejected: it is the jump this fixes.
2. **Viewport meta only.** Rejected: iOS Safari ignores it, so the iPad would still jump.
3. **Overlay the chrome on the canvas.** Rejected here: a redesign, not a zoom fix; a separate ticket if wanted.

## Consequences

- A low-vision person can no longer enlarge the interface text with the browser. A UI-scale preference is a possible follow-up, not part of this change.
- Gesture handlers must tell "inside the canvas" from "outside" by where the gesture started.
- Hard to reverse in practice: people stop relying on page zoom, and a lock that is later lifted brings the jump back.
