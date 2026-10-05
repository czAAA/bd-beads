# 278: Bundle Inter 600

**What to build:** The design system's `title` type style is Inter 600, and DESIGN.md §4.4 says 600 is bundled, but `public/fonts/` and `src/styles/fonts.css` have only 400, 500 and 700. With `font-synthesis: none` the Modal, Stepper, BottomSheet and sidebar titles render at the nearest face, and `loadPrintFonts` in `src/rendering/printPages.ts` loads only 400 and 700 so exports can fall back too. Add the faces and fix the loader. Source: the audit of design system v18 against the app (2026-10-04).

**Blocked by:** 273

**Human involvement:** autonomous

**Status:** done

- [ ] Inter 600 latin, latin-ext and cyrillic woff2 files from the same source as the other faces (with the licence file already there), same-origin, listed in `fonts.css`
- [ ] `loadPrintFonts` also loads 600 where the PNG/PDF facts use it, and an export test or check would fail without it
- [ ] `--type-title` and the hard-coded `font-weight: 600` in `BeadsExample.vue` and `PlanTiles.vue` render in real 600 (a visual reference or a computed-font check)
- [ ] No third-party font request is added (the `tokens` test still passes); DESIGN.md §4.4 stays true
