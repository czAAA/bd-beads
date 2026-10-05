# 295: Everything under 1024px is the phone layout, with no header

**What to build:** Every width under 1024px, in portrait and landscape, uses the phone layout (ADR 0032). This fixes the bug where a phone on its side (wider than 743px) gets the iPad layout, which leaves almost no canvas. The screen belongs to the canvas: no header, no canvas header strip, and a slim icon-only Dock.

- **Retire the iPad mini tier:** remove the Drawer, the BottomToolbar, the 744-1023px header and their media queries and tests. `wide` (1024px) is the only split left. The landscape left rail goes: one bottom Dock in both orientations.
- **No header, no canvas header strip** under 1024px. The canvas starts at the top edge, padded by `env(safe-area-inset-top)`. The strip's Project info moves into the Project sheet; its zoom and Rulers controls are already the Zoom pill's.
- **Dock:** five slots: Tool, Colour, Frame, Project, Menu.
  - **Icon-only, no text labels below the icons, at every height** (accessible names and Tooltips stay). Because the label row goes, the Dock is slimmer everywhere: 48px plus the bottom safe-area inset, in both orientations (down from 64px). Cap it at about 480px wide, centred.
  - The Frame slot uses the `frame` icon, and its sheet also holds Rotate, Copy and Paste (the old Edit sheet minus Undo and Redo, which ticket 296 moves to the Zoom pill). The Edit slot goes.
  - The Menu slot is last: a modal sheet with language, theme, Name on exports, Keyboard shortcuts (only with a keyboard attached), Overview and the AGPL source link. Everything about the open Project stays in the Project sheet; nothing is duplicated.
  - With no Project open, the New Project / Import bar replaces the Dock, with the Menu button at its bottom right, so language and theme stay reachable.
- **Frame bar** (size, Fit to drawing, ✕, Done) floats at the top-centre of the canvas box over the beads while the Frame is being set, instead of taking a row.
- **Undo and Redo, the Row progress toggle and the movable pill** are tickets 296 and 297. Until 296 lands, Undo and Redo stay reachable from the Frame sheet.
- **Design system, same commit** (DESIGN.md §6): `responsive.md` (four tiers; the Phone tier's header, landscape and dock lines; the iPad-mini section removed), the Dock card (icon-only, 48px, five slots, Menu), the Frame bar, tokens/`bundle.css`/`design-values.css` if a value changes, and a line in the README's Version changelog. Update `CONTEXT.md`'s App shell layout entry and the Tooltip fit check's widths.

**Blocked by:** none

**Human involvement:** interactive (check on a real phone in portrait and landscape and on an iPad)

**Status:** ready-for-agent

- [ ] At 844x390, 956x440, 390x844 and 820x1180 the page has no header; the canvas fills the screen above the Dock
- [ ] No Drawer, BottomToolbar or iPad header exists in the code; no media query for 744-1023px remains
- [ ] The Dock is icon-only, 48px plus the safe-area inset, in portrait and landscape; every slot keeps its accessible name and Tooltip
- [ ] The Dock reads Tool, Colour, Frame, Project, Menu; the Frame sheet holds the Frame controls plus Rotate, Copy and Paste
- [ ] The Menu holds exactly the items above; the Project sheet holds the open Project's name, size, bead and save state
- [ ] With no Project open, the New / Import bar shows the Menu button at its bottom right
- [ ] The Frame bar floats at the top-centre of the canvas box and never covers the Dock
- [ ] The notch and status bar do not overlap the canvas in either orientation
- [ ] ADR 0032 is linked from `responsive.md`; the visual and Tooltip fit checks cover the new widths
