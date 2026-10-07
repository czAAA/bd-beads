# 324: Pen mode and Mouse mode icons in the design system

**What to build:** Two new icons for the design system, in the bd-beads icon style, that a person recognises at a glance as the pair "draw with the pen" (Pen mode) and "draw with finger or mouse" (Mouse mode). They are the faces of the input mode toggle (ticket 325). They read at Tool button size, sit well beside the existing pencil icon (ticket 249) and the other tool icons without being mistaken for the Paint or Hand tool, and work in the light, dark and high contrast themes with the active one in the accent colour.

Per CLAUDE.md's Design section, the design system is changed in place in this commit: the icon files in `docs/design/system/`, the card's `README.md`, tokens and `bundle.css` / `src/styles/design-values.css` where affected, and a line in the README's Version changelog (`DESIGN.md` §6). Icons are not redrawn elsewhere.

**Blocked by:** None (can start immediately).

**Status:** done

- [x] Two icon files (Pen mode, Mouse mode) exist in `docs/design/system/`, matching the stroke, grid and corner rules of the existing icons
- [x] They are clearly distinguishable from each other and from the pencil (Paint) and Hand tool icons at the Tool button size
- [x] They render correctly in light, dark and high contrast themes using role-named tokens only
- [x] The design system README documents both icons and the version changelog has a line for them
- [x] If an icon registry or spec sheet in the repo lists the icons, both are added there
