# 275: Tablet toolbar and phone Dock: the Toolbox's icons, a corner hotkey, Frame as a tool

**What to build:** The iPad mini's BottomToolbar and the phone Dock show the same tool icons as the Toolbox and print the tool's key in a corner, as the last v18 export (copied in by ticket 273) says. The cards (`BottomToolbar`, `Dock`, `ToolSheet`, `ToolTabs`, `accessibility.md`, `responsive.md`) are the spec; read them, don't restate values here.

- **BottomToolbar:** six tools (Paint, Fill, Select, Erase, Hand, Frame), the Toolbox's own icons at 22px, each with its key (1, 2, 3, E, H, F) in the top-right corner (DM Mono 11px, `muted`, `accent` on the active tool). Colour, Undo and Redo have no key. Frame is a tool here as it is in the Toolbox.
- **Dock:** the first button shows the active tool's own icon (`paint`, `fill`, `select`, `erase`, `hand`) and its key in the corner (DM Mono 12px, `muted`, `accent` on the active tool, a different right inset in the landscape rail); the Frame button shows `frame` and F. Colour, Edit, Mirror and Pattern are groups and have no key.
- **ToolSheet:** the phone sheet's 72px labelled tiles keep their size and labels (thumb targets, not Toolbox tiles) and also print the tool's key (1, 2, 3, E, H) in the top-right corner, as the Dock does (DM Mono 12px, `muted`, `accent` on the active tile; no key on Remove line or Clear). The person decided this on 2026-10-04; the `ToolSheet` card text says so, and its `preview.html` doesn't draw the corner yet, so add it there.

Today `ToolButton.vue` hides the key badge on a coarse pointer and on phone, and the Dock shows one generic tool button. The card wants the key on every device, so drop that hiding. Interactive: the person checks the result on a tablet and a phone before it merges.

**Blocked by:** 274

**Human involvement:** interactive

**Status:** ready-for-agent

- [ ] BottomToolbar: six tools, the Toolbox's icons at 22px, the corner key on each tool and none on Colour, Undo or Redo; the Frame tool starts Set Frame as the Toolbox's does
- [ ] Dock: the first button shows the active tool's icon and key, the Frame button shows its icon and F, with the card's sizes, insets and `accent` on the active tool, in portrait and in the landscape rail
- [ ] The key badge shows on coarse pointers and phone too (it is `aria-hidden`; the names stay the tool names), and nothing overflows at 320px in English and Russian
- [ ] Tooltips, `aria-keyshortcuts`, focus rings and the active, pressed and disabled states match the Toolbox tile's; the phone ToolSheet tiles show the corner key and keep their size and labels
- [ ] Unit tests for the changed components; the tablet and phone visual references regenerated deliberately; the README Version changelog has a line
