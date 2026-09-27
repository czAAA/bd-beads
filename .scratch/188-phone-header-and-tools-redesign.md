# 188: Phone/mobile header & tools redesign

**What to build:** Redesign the phone/vertical-iPad-mini header and related small-viewport tool surfaces so nothing is out of viewport or unreachable: stack the app name and bead icon (the bead gets its own design-system-style icon, label shown on hover), the same treatment for the technique/schema selector and the theme selector (icon plus click-to-open selector); hide the "bd-beads" wordmark at this width; reclaim the space taken by the name/size readout; move the pattern name under "More" in the vertical layout. Fix the zoom pill's icon alignment and visibility. Add the missing "More" overflow button next to Undo/Redo (labeled "More", not "…more"). Redesign the Progress bar into a compact icon-only mode with a "1/222" counter, a direction toggle, and icon-only row-done/not-done controls with hover text. Stop the Size drawer's tooltip from opening automatically when the drawer opens. Add a new library-style icon for Saved Patterns, applied at every size tier (add it to the design system first, per DESIGN.md). Remove Import from the Edit tools group — decided redundant.

**Blocked by:** None (can start immediately). Overlaps ticket #79 (Responsive: phone tier) and #168 (iPad mini tier) — those tickets left these specific issues open after a real-device pass; this ticket fixes them directly rather than reopening #79/#168.

**Status:** ready-for-agent

- [ ] At phone/iPad-mini-portrait widths, every header control is reachable and within the viewport
- [ ] App name + bead render stacked, with the bead as its own icon and a label shown on hover
- [ ] Technique/schema selector follows the same icon + hover-label + click-to-open pattern
- [ ] Theme selector is a single icon showing the current theme, with a click-to-open selector
- [ ] "bd-beads" wordmark is hidden at this width
- [ ] Name/size readout no longer dominates the header's width
- [ ] Pattern name appears under the "More" menu in vertical mobile layout
- [ ] Zoom pill's icons are aligned/centered and the pill is fully visible, not clipped
- [ ] A "More" overflow button appears next to Undo/Redo, labeled "More"
- [ ] Progress bar has a compact mode: "1/222" counter, direction toggle, icon-only row-done/not-done with hover text
- [ ] Opening the Size drawer does not auto-open its tooltip
- [ ] Saved Patterns uses a new library-style icon, added to the design system first, applied at every size tier
- [ ] Import control removed from the Edit tools group (confirm no other tool group loses its own needed access to Import in the process)
