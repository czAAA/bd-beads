# 249: Pencil and palette icons in the design system

**What to build:** The Paint tool is drawn as a pencil, the way people expect a drawing tool to look, and the Colors button gets its own palette glyph so the two no longer share one icon. Both icons are made in the design system on claude.ai first (CLAUDE.md, Design), then copied into `docs/design/system/` with the rest of the system; nothing is drawn by hand in the repo. Nothing in the app uses the old circle-and-line Paint glyph afterwards.

- **Paint tool:** a pencil, in the system's icon style (24 box, 1.75 stroke, round caps and joins).
- **Colors button** (the phone Dock's Colors item and anywhere else Colors is shown as an icon): a palette glyph, clearly different from the pencil at 18px.
- The tool keeps the name "Paint" everywhere; only the glyph changes.

**Blocked by:** None (can start immediately). Needs the design system on claude.ai, so the owner's step comes first.

**Status:** ready-for-agent

- [ ] Pencil and palette icons exist in the design system on claude.ai, with the Icons README updated
- [ ] They are copied into `docs/design/system/` (assets and README) by the copy-in procedure in `DESIGN.md` §6, not edited by hand
- [ ] The Paint tool shows the pencil in the Toolbox, the BottomToolbar, the phone tool sheet and the Dock's tool item while Paint is active
- [ ] The Dock's Colors button shows the palette glyph; the old `paint` icon is removed from the icon set and no longer referenced
- [ ] The two glyphs are told apart at 18px in the light, dark and high contrast themes
- [ ] The Tour and Overview show the new glyphs wherever they draw the tools
- [ ] Screenshots and visual tests that include these icons are updated
- [ ] CONTEXT.md needs no change (the tool is still named Paint)
- [ ] Overview and Tour question (CLAUDE.md): asked of the user; answer: no Overview tile, since this is a visual refresh; the Tour needs only a check that its tool steps still read right
