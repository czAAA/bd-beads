# 136: Design foundation: tokens, two themes, bundled fonts

**What to build:** The app follows the device's light or dark setting, live, with no flash of the wrong theme, and every screen can read the new role-named tokens from `DESIGN.md` and the design system files in `docs/design/system/` (`DESIGN.md` §10) (§2, §3). The new tokens are added **beside** the ticket-02 tokens (expand step): nothing looks different yet, and each later restyle ticket moves its own components over. Inter, DM Mono and Instrument Serif are bundled with the app as same-origin `woff2` files (no font CDN, per ADR 0001 and ADR 0021), with the two Cyrillic fallbacks (JetBrains Mono, Source Serif 4), so the app works offline and ticket 69 can cache them.

**Blocked by:** 156 (DESIGN.md becomes the entry point to design system v13)

**Status:** ready-for-agent

**Design system v13:** take every value from the design system's `tokens.json` / `tokens.css`: three themes (light, dark, high contrast), and the layout, z-index, motion, loading-delay, touch-target and print token groups. Sizes are in `rem`.

- [ ] Every token in `DESIGN.md` §3.1–3.5 (color, type roles, spacing, radii, elevation) exists as a CSS custom property for both themes, values exactly as documented
- [ ] The resolved theme is written as `data-theme` and `color-scheme` on the root element before first paint, and follows `prefers-color-scheme` live while the user has made no pick
- [ ] The fonts load from the app's own files with no third-party request, and the Russian UI falls back per glyph (§3.2)
- [ ] The old ticket-02 tokens still exist and the current UI is visually unchanged
- [ ] Tests cover theme resolution from the device setting and its live change
- [ ] The high contrast token set exists and is selected by `data-theme="contrast"` or `prefers-contrast: more` while no theme is picked
- [ ] Motion, z-index and layout tokens exist; `lang` on the root element follows the app language
