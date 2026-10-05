# Everything under 1024px is the phone layout

**Status: accepted.** Supersedes the iPad-mini-tier parts of ticket 168 (the Drawer, the BottomToolbar and the 64px header at 744-1023px) and the phone-landscape rail of ticket 79. Ticket 295.

## Context

The layout was chosen by viewport width alone: phone under 744px, iPad mini 744-1023px, then three wider tiers. A phone on its side (844x390, 956x440) is wider than 743px, so it fell into the iPad mini tier: a 64px header, the canvas header strip, the Frame bar, the Progress bar and a 64px toolbar stacked on a screen 390px tall, leaving almost no canvas. `responsive.md` said a short phone keeps the phone layout whatever its width; the CSS only did so under 744px wide.

## Decision

- Every width under 1024px uses the phone layout, in portrait and landscape. The iPad mini tier is retired: no Drawer, no BottomToolbar, no iPad header. The responsive table goes from five tiers to four.
- No header at those widths. Its contents move: the open Project's info into the Project sheet; language, theme, Name on exports, Keyboard shortcuts, Overview and the source link into the Menu, the Dock's last slot; Undo, Redo and the Row progress toggle into the Zoom pill.
- One Dock in both orientations (the left rail goes), icon-only (the labels go; names stay as accessible names and Tooltips), so it is slim at every height.

## Considered options

1. **Keep the iPad tier and make short screens use the phone layout** (what `responsive.md` already claimed). Rejected: it fixes only the landscape bug, keeps two touch layouts to build, test and keep in step, and still spends 64px on a header on an iPad held either way.
2. **Free space only in the iPad tier** (a slimmer header, hiding the canvas strip). Rejected: the screen's height, not its width, is what is scarce.

## Consequences

- The six one-tap tools of the BottomToolbar become a Dock that opens sheets: one more tap on an iPad. The Dock's Tool slot shows the active tool, as on the phone.
- 1024px becomes the only split between the touch layout and the desktop layout.
- Hard to reverse: the Drawer, BottomToolbar, their tests and the iPad media queries are deleted, not hidden.
