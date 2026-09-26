# 138: X1 logo and favicon set

**What to build:** The X1 Cross-weave mark from `DESIGN.md` §6.2 is available as a reusable logo component (inline, `currentColor`-driven stroke, with the heavier stroke at small sizes), and the browser tab shows the theme-aware favicon from §6.3, replacing the current QR-style favicon. The header ticket (142) places the mark.

**Blocked by:** None (can start immediately)

**Status:** ready-for-agent

**Design system v13:** the ready-to-ship favicon set is in `docs/design/system/favicon/` (theme-aware `favicon.svg`, `favicon.ico`, `favicon-32.png`, `apple-touch-icon.png`).

- [ ] The logo component draws the mark at 16, 22 and 32px with strokes 4.2, 3.8 and 3.6 (3.2 elsewhere) and takes its color from the surrounding token
- [ ] `favicon.svg` follows the browser's light or dark setting (orange `#fa520f` / yellow `#faff69`), with `favicon.ico` (16, 32, 48), `favicon-32.png` and `apple-touch-icon.png` as fallbacks, all linked from the page
- [ ] The logo and favicon files come from `docs/design/system/assets/Logos/`, not redrawn
- [ ] The old `favicon.svg` is gone and no page references it
- [ ] The app-icon files are available for the PWA manifest (ticket 69) without further drawing
- [ ] The favicon files are copied from `docs/design/system/favicon/`, not rebuilt
