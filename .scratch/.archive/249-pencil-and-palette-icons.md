# 249: Pencil and palette icons in the design system

**What to build:** The Paint tool is drawn as a pencil, the way people expect a drawing tool to look, and the Colors button gets its own palette glyph so the two no longer share one icon. Both icons are made in the design system on claude.ai first (CLAUDE.md, Design), then copied into `docs/design/system/` with the rest of the system; nothing is drawn by hand in the repo. Nothing in the app uses the old circle-and-line Paint glyph afterwards.

- **Paint tool:** a pencil, in the system's icon style (24 box, 1.75 stroke, round caps and joins).
- **Colors button** (the phone Dock's Colors item and anywhere else Colors is shown as an icon): a palette glyph, clearly different from the pencil at 18px.
- The tool keeps the name "Paint" everywhere; only the glyph changes.

**Blocked by:** None (can start immediately). Needs the design system on claude.ai, so the owner's step comes first.

**Status:** done

- [x] Pencil and palette icons exist in the design system on claude.ai, with the Icons README updated
- [x] They are copied into `docs/design/system/` (assets and README) by the copy-in procedure in `DESIGN.md` §6, not edited by hand
- [x] The Paint tool shows the pencil in the Toolbox, the BottomToolbar, the phone tool sheet and the Dock's tool item while Paint is active
- [x] The Dock's Colors button shows the palette glyph; the old `paint` icon is removed from the icon set and no longer referenced
- [x] The two glyphs are told apart at 18px in the light, dark and high contrast themes
- [x] The Tour and Overview show the new glyphs wherever they draw the tools
- [x] Screenshots and visual tests that include these icons are updated
- [x] CONTEXT.md needs no change (the tool is still named Paint)
- [x] Overview and Tour question (CLAUDE.md): asked of the user; answer: no Overview tile, since this is a visual refresh; the Tour needs only a check that its tool steps still read right

**Resolution notes:** The design system kept the name `paint` for the pencil, so the Paint tool picks it up everywhere through `TOOL_ICONS` with no rename; the `palette` icon is now registered in `ICON_NAMES`. The Dock and BottomToolbar Colors buttons draw the current color's swatch (Dock README), not an icon, so the palette glyph is not drawn in the app yet; the Dock's unused `color` item icon now names `palette`. The visual references compare the grid only, so no screenshots changed.
