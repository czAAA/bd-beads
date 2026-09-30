# 219: Overview coffee tile

**What to build:** The coffee tile from the design system's Overview card: a beaded cup with three beads of steam, "Made by one person" in `serif-heading` 30px, one line of copy, and a **Buy me a coffee** secondary button. For now the button does nothing: it isn't a link and goes nowhere. The maker's page, and making the button open it, will be a separate ticket.

**Blocked by:** None (can start immediately).

**Status:** ready-for-agent

- [ ] The tile appears below the feature carousel as in the design system, with the cup drawn from beads in Palette colours
- [ ] **Buy me a coffee** is a real button in its place in the tab order and does nothing when pressed, with no navigation and no console error
- [ ] No donation-service name, logo or colours appear anywhere on the tile
- [ ] The cup and steam are decorative and `aria-hidden`
- [ ] English and Russian copy from the design system (Writing section, "Copy added in v15"); the page still starts in English on a device with no saved language
- [ ] Correct at all five screen sizes and in the light, dark and high contrast themes; fully usable with the keyboard alone
- [ ] Uses the design system tokens and type roles only (no hardcoded colors, fonts, sizes or shadows); loads no third-party fonts or scripts
- [ ] Matches the Overview card and its preview in the design system
- [ ] Overview and Tour question (CLAUDE.md): not applicable, this ticket completes the Overview itself
