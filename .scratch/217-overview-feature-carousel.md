# 217: Overview feature carousel

**What to build:** The Overview's "What's inside" section becomes the design system's carousel of the seven features (Techniques, Pattern editing, Convert image, Row progress, Beads needed, Exports, Saved Patterns; Mirror stays unlisted while its controls are hidden, ticket 174), replacing ticket 77's plain list. From 1024px: the list on the left (the selected item on `panel` with a 2px `accent` bar and its line), the feature's stage on the right with its number, title and description, and ‹ › with "3 / 7" top-right. Below 1024px: swipe cards with dots and ‹ ›. The stage is empty until ticket 218 fills it with the examples. The heading uses `serif-heading` with no label above it.

**Blocked by:** None (can start immediately).

**Status:** ready-for-agent

- [ ] The seven features appear in the order above, each with its Icons v2 icon and the design system's description, as in ticket 77
- [ ] From 1024px the list is a `tablist`; arrow keys move between features, and ‹ › and "n / 7" stay in step with the selection
- [ ] Below 1024px the cards swipe, the dots and ‹ › stay in step, and reduced motion removes the slide animation
- [ ] On a MacBook Air the whole carousel is above the fold
- [ ] Screen readers get a named tablist with each panel labelled by its tab
- [ ] English and Russian copy from the design system (Writing section, "Copy added in v15"); the page still starts in English on a device with no saved language
- [ ] Correct at all five screen sizes and in the light, dark and high contrast themes; fully usable with the keyboard alone
- [ ] Uses the design system tokens and type roles only (no hardcoded colors, fonts, sizes or shadows); loads no third-party fonts or scripts
- [ ] Matches the Overview card and its preview in the design system
- [ ] Overview and Tour question (CLAUDE.md): not applicable, this ticket completes the Overview itself
