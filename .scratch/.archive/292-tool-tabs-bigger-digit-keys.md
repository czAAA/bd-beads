# 292: Bigger Tool tabs, selected by an underline, and the tools on keys 1–6

**What to build:** Three changes to the Tools group, agreed in the grill session (screenshots approved by the maker).

1. **Digit keys.** Paint 1, Fill 2, Select 3, Erase 4, Hand 5, Frame 6; 7 to `=` are left free for later tools. The letters E, H and F stop being tool shortcuts (no aliases). Everywhere a key is shown (corner badge, Tooltip, `aria-keyshortcuts`, the Keyboard shortcuts modal, the Tour copy, the Overview, English and Russian) it is the digit. Shift+1…9, 0, Q, W stay the Palette. Del still erases a Selection and R, P, D are unchanged. Esc from Set Frame, and the Hand tool's Space+drag, are unchanged.
2. **Look (desktop Toolbox).** The Tools group is a tab strip, no tile background: the icon at 34px in a 56px-wide, 72px-tall tab, 5 per row (Frame wraps to a second row). Each row has a full-width 1px `line-strong` rule under it. The active tab's icon and key turn `accent-strong` (yellow `accent` in dark) with a 2px accent underline over the rule, replacing the inset outline of v18 (this is the v16 tab look again, on icons). The hotkey sits against the icon's top-right corner, DM Mono 11px, `muted`, accent when active. The MacBook-tier left column grows from 326px to 366px (`--column-width`: 20.375rem to 22.875rem) so five 56px tabs fit; the layout elsewhere follows from the new width. The 366px column is a design decision, not a free side effect: check the canvas box, the Drawer and the visual references.
3. **Other tiers.** The iPad toolbar, the phone Dock and ToolSheet tiles take the same icon scale, the underline selection and the digit key. Use the largest tab (up to 56px wide, 34px icon) that the tier's width allows and wrap rather than shrink below 44px; flag the result for a human visual check on a real iPad and phone.

Update in the same change (CLAUDE.md Design rules): the ToolTabs card (README, `preview.html`), the Toolbox, BottomToolbar, Dock, ToolSheet and ShortcutsHelp cards where they name the keys or the look, tokens/`bundle.css`/`src/styles/design-values.css` for the column width, a line in the design README's Version changelog, and CONTEXT.md (**Set Frame**, **Hand tool**, **Eraser** keys, **Tool button**, **Toolbox**: done in this ticket's grill session, re-check). Update the key tests (App.hotkeys, App.keyboard, Toolbox, BottomToolbar, AppDock, ShortcutsHelp), the Tour and the visual references and text-fit/hover specs that move. No ADR: the keys and look are easy to change back.

**Blocked by:** none (294 touches the same tiles; whichever lands second rebases)

**Human involvement:** needs a human to confirm the other tiers' sizes on real devices

**Status:** done

- [ ] 1–6 select Paint, Fill, Select, Erase, Hand, Frame; E, H, F do nothing; Shift+digit still picks the Palette
- [ ] Every shown key (badge, Tooltip, shortcuts modal, Tour, Overview, EN and RU) reads the digit
- [ ] Desktop Toolbox: 56×72 tabs, 34px icons, 5 per row, full-width rule per row, 2px accent underline on the active tab, no tile background, key by the icon's top-right
- [ ] Left column 366px at the MacBook tier; no overflow in the canvas box; dark and high-contrast themes checked
- [ ] iPad toolbar, Dock and ToolSheet match the new icon scale, underline and key
- [ ] Design system (ToolTabs card and the others above, tokens, changelog) and CONTEXT.md updated; related tests and references updated
