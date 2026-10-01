# 224: The size unit becomes a label on the input's border

**What to build:** On the New Pattern form, the Width and Height inputs no longer carry the unit ("beads", "mm" or "cm") as small text inside the field at the right. The unit instead becomes a small label sitting on the input's border, and its text follows the Unit the user has chosen. Changing the Unit control changes the label at once, in both inputs, in English and Russian. The inputs' values, Stepper buttons, validation and errors behave as before.

**Blocked by:** None for the code: the border label is already written into the local copy of the design system (NumberField card, `forms-and-states`, `bundle.css`). That copy was edited by hand ahead of claude.ai, so the same change must be made on claude.ai and synced (`/design-sync`) before this ships, or the next sync will overwrite it.

**Status:** ready-for-agent

- [ ] Width and Height show the chosen Unit as a label on the border, not inside the field; switching between beads, mm and cm updates both labels immediately
- [ ] The label stays readable and doesn't overlap the typed value or the Stepper buttons, including a long value, the empty state, and the Russian unit names
- [ ] Focus, invalid and disabled states restyle the label with the field's border, as the design system describes
- [ ] A screen reader still gets the unit with the field (the label is not `aria-hidden` content that is lost), without reading it twice
- [ ] Any other NumberField that shows a unit (if one exists) follows the same rule, or the ticket records why it doesn't
- [ ] Correct at all five screen sizes and in the light, dark and high contrast themes; fully usable with the keyboard alone
- [ ] Uses the design system tokens and type roles only (no hardcoded colors, fonts, sizes or shadows)
- [ ] Matches the NumberField card in the updated design system
- [ ] Overview and Tour question (CLAUDE.md): asked of the user; answer: neither the Overview (77) nor the Tour (80)
