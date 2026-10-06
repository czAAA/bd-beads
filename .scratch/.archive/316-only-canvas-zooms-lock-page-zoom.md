# 316: Only the canvas zooms; lock the browser's page zoom

**What to build:** The app is a drawing tool, so the header, Toolbox, left column, Dock and sheets must never change size or jump. Lock **Page zoom** and leave **Canvas zoom** as the only zoom (ADR 0034). On the iPad a double-tap by finger or Pencil, or a pinch off the canvas, does nothing; on desktop Ctrl/⌘ + wheel outside the canvas does nothing; inside the canvas they zoom the canvas as today. A gesture only zooms the canvas if it starts inside it. Ctrl/⌘ + plus, minus and 0 drive Canvas zoom (check existing shortcut bindings first, and the 10% Zoom floor and Fit cap still apply). Add `overscroll-behavior: none` on the page and scrolling areas, keeping their touch-scroll. The layout itself does not change. Include `gesturestart`/`gesturechange` blocking outside the canvas, as iOS Safari ignores `user-scalable=no`.

**Blocked by:** None (can start immediately).

**Status:** done

- [ ] Viewport meta, `touch-action: manipulation` on the shell, outside-canvas Ctrl/⌘ + wheel and iOS gesture events are cancelled; ones started inside the canvas still zoom it
- [ ] Double-tap and pinch on header, Toolbox, Dock and sheets do nothing (iPad Safari, finger and Pencil)
- [ ] Ctrl/⌘ + plus, minus, 0 change Canvas zoom, not Page zoom, including with a text field unfocused
- [ ] A gesture that starts outside the canvas and moves onto it stays inert
- [ ] Left column and sheets still scroll by touch and wheel; no overscroll bounce moves the page
- [ ] Layout unchanged from phone through desktop
- [ ] CONTEXT.md has Canvas zoom and Page zoom (done in the grilling); ADR 0034 added; design system `responsive.md` / interaction notes updated if they mention page zoom (DESIGN.md §6)
- [ ] Follow-up noted, not built: a UI-scale preference for low-vision users
- [ ] Overview and Tour question (CLAUDE.md): not asked, Tour is off
