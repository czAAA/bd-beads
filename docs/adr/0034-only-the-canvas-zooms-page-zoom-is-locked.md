# Only the canvas zooms; the browser's page zoom is locked

**Status: accepted.** Ticket 316.

bd-beads is a drawing tool. A double-tap by finger or Pencil on the iPad, a pinch off the canvas, or Ctrl + wheel on the desktop used to page-zoom the header, Toolbox and Dock, and the layout jumped mid-drawing.

- **Page zoom is locked; Canvas zoom is the only zoom.** A zoom gesture changes the canvas only when it starts inside the canvas; started anywhere else it does nothing, and one that drifts onto the canvas stays inert.
- **Locked in layers**, because each browser ignores some: `maximum-scale=1, user-scalable=no` in the viewport meta; `touch-action: manipulation` on the shell (no double-tap zoom); a non-passive `wheel` listener cancelling Ctrl/⌘ + wheel outside the canvas; `gesturestart`/`gesturechange` cancelled outside the canvas, since iOS Safari ignores `user-scalable=no`.
- **Keyboard zoom** (Ctrl/⌘ + plus, minus, 0) drives Canvas zoom, as drawing tools such as Excalidraw do. The browser's menu zoom can't be stopped and isn't handled.
- `overscroll-behavior: none` on the page and the scrolling areas, so nothing moves the page; their own touch-scroll stays.

**Considered options**: leaving page zoom to the browser (rejected: it is the jump); the viewport meta only (rejected: iOS Safari ignores it); overlaying the chrome on the canvas (a redesign, not a zoom fix).

**Consequences.** A low-vision person can no longer enlarge the interface with the browser; a UI-scale preference is a possible follow-up. Gesture handlers tell inside from outside the canvas by where the gesture started.
