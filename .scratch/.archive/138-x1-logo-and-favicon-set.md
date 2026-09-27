# 138: X1 logo and favicon set

**What to build:** The X1 Cross-weave mark from the design system README's Logo is available as a reusable logo component (inline, `currentColor`-driven stroke, with the heavier stroke at small sizes), and the browser tab shows the theme-aware favicon from its Favicon section, replacing the current QR-style favicon. The header ticket (142) places the mark.

**Blocked by:** None (can start immediately)

**Status:** done

**Design system v13:** the ready-to-ship favicon set is in `docs/design/system/favicon/` (theme-aware `favicon.svg`, `favicon.ico`, `favicon-32.png`, `apple-touch-icon.png`).

- [x] The logo component draws the mark at 16, 22 and 32px with strokes 4.2, 3.8 and 3.6 (3.2 elsewhere) and takes its color from the surrounding token
- [x] `favicon.svg` follows the browser's light or dark setting (orange `#fa520f` / yellow `#faff69`), with `favicon.ico` (16, 32, 48), `favicon-32.png` and `apple-touch-icon.png` as fallbacks, all linked from the page
- [x] The logo and favicon files come from `docs/design/system/assets/Logos/`, not redrawn
- [x] The old `favicon.svg` is gone and no page references it
- [x] The app-icon files are available for the PWA manifest (ticket 69) without further drawing
- [x] The favicon files are copied from `docs/design/system/favicon/`, not rebuilt
