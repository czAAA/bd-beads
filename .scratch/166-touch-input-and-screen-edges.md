# 166: Touch input and screen edges

**What to build:** The app works with fingers and Pencil at any width, as `responsive.md` ("Input, not width" and "Screen edges and height") describes: every control keeps its drawn size but gets a 44×44px hit area on a coarse pointer (tool tabs 48px tall, swatches at least 36px), nothing is hover-only (the Saved Pattern Remove × is always visible, tooltips become long-press, no hover paint preview), Keyboard shortcuts shows only with a fine pointer or keyboard, heights use the dynamic viewport so the browser's address bar never hides the Progress bar, safe-area insets are respected, and a stroke on the drawing surface never scrolls the page.

**Blocked by:** 152

**Status:** ready-for-agent

- [ ] `(pointer: coarse)` gives every control a `touch-target` hit area without changing its look
- [ ] No action is reachable only by hovering on a touch device
- [ ] The Progress bar stays visible on iPhone and iPad Safari with the address bar shown or hidden
- [ ] `touch-action: none` on the drawing surface; painting on a tablet never scrolls the page
- [ ] Ticket 103's performance check passes at iPad size
