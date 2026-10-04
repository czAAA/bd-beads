# 284: Design system cards follow the app

**What to build:** Fix the cards, tokens and guideline files where the app deliberately differs, so the design system describes what the app does (ADR 0030). Each deviation gets a one-line reason: the zoom cluster order (out, Fit, in; no level readout); the Dock without Mirror (ticket 174), where the `Dock`, `ScreenSizes` and `responsive.md` lists include it; dark Night is `#202020`, not `#1a1a1a`; the Saved Projects column gap of 8px (ticket 175); the larger touch hit area of the palette × badge; the size unit as the placeholder and not a border label in the New Project form (commit 48ae79e, which reverted ticket 224); the tool is named "Eraser" (ticket 250); the Frame margin Message counts "bead", not "piece" (ticket 277). Also: add `canvas-bg-1` to `canvas-bg-6` to `tokens.json` and `tokens.css` (dark Night as the app has it) and drop the two app-specific overrides in `src/rendering/canvasBackgrounds.ts` and DESIGN.md §4.2; remove the "pieces outside the Frame" count from the `CanvasStrip` card (ticket 259); fix `accessibility.md` line 25 ("the active tool its underline", which the v18 card contradicts); and tidy the README's stale "Not synced" and `api/` lines. Source: the audit of design system v18 against the app (2026-10-04).

**Blocked by:** 273

**Human involvement:** autonomous

**Status:** ready-for-agent

- [ ] Every deviation above is written on its card or guideline file with its reason; no card describes something the app does not do
- [ ] `canvas-bg-1` to `canvas-bg-6` are tokens in both token files (the `tokens` test passes), `canvasBackgrounds.ts` reads them, and DESIGN.md §4.2 loses the override text
- [ ] The `CanvasStrip` card has no outside-the-Frame count; `accessibility.md` and the README no longer carry the stale lines
- [ ] The README Version changelog has one line per change
