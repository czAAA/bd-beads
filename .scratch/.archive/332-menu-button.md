# 332: MenuButton: one button that opens a popover or sheet

**What to build:** `MenuButton` wraps `AppButton` or `IconButton` and opens a popover (desktop) or a sheet (under 1024px). It owns `aria-expanded`, `aria-haspopup`, focus return and closing on `Escape` or an outside click. It covers the Export menu, the header Menu, the Dock slots that open sheets, Image colors, Canvas color and the Custom color picker. Its Tooltip body can be built from the list of what it opens (for example "Set Frame, Rotate, Copy, Paste."). It reuses `AppMenu`/`AppMenuItem` for menu lists.

**Spec:** 343 (unified controls spec)

**Blocked by:** 330, 331

**Status:** done

- [x] One `MenuButton` opens a popover or sheet with the right ARIA state and focus handling
- [x] The Tooltip body can be generated from the item names
- [x] Unit tests cover opening, closing and focus return
