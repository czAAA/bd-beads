# Everything under 1024px is the phone layout

**Status: accepted; amended by [ADR 0046](0046-the-dock-layout-is-the-main-layout.md)** (the Dock layout now runs at every width, with the Canvas strip back; the 1024px split applies only with the flag off). Tickets 295–297. Layout detail: `docs/layout.md`.

The layout used to be chosen by width alone, with an iPad mini tier at 744–1023px. A phone on its side (844 × 390) fell into it and stacked a 64px header, the canvas strip, the Frame bar, the Progress bar and a 64px toolbar on a screen 390px tall, leaving almost no canvas. On a phone or a tablet held either way, height is what is scarce.

- **Every width under 1024px uses the phone layout**, in portrait and landscape. 1024px is the only split between the touch layout and the desktop layout ([ADR 0021](0021-visual-language-follows-design-md.md)). There is no iPad mini tier, no Drawer and no BottomToolbar.
- **No header at those widths.** The open Project's info is in the Project sheet; language, theme, Name on exports, Keyboard shortcuts, Overview and the source link are in the Menu; Undo, Redo and the Row progress switch are in the Zoom pill.
- **One Dock in both orientations**, icon-only (names stay as accessible names and Tooltips), opening sheets. Its Tool slot shows the active tool.
- **The desktop layout works with touch and Pencil too**, as a landscape iPad gets it: nothing in either layout needs hover ([ADR 0001](0001-local-only-persistence.md)).

**Considered options**: keeping the iPad tier and sending only short screens to the phone layout (rejected: fixes only the landscape bug, and keeps two touch layouts to build, test and keep in step); freeing space only in the iPad tier (rejected: height, not width, is what is scarce); choosing the layout by pointer type (rejected: a landscape iPad has room for the column, and the 1024px split is one rule to test).

**Consequences.** The BottomToolbar's one-tap tools became a Dock that opens sheets: one more tap on an iPad. The Drawer, the BottomToolbar and the iPad media queries are deleted, not hidden.
