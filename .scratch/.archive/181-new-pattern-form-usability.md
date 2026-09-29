# 181: New Pattern form: name auto-highlight + clickable size inputs

**What to build:** When the New Pattern form opens, auto-select/highlight the Name input to encourage naming. Make the Width/Height numeric inputs reliably clickable/focusable, including bringing up the on-screen keyboard on phone, and add small stepper (up/down) controls so size can be set entirely by clicking/tapping.

**Blocked by:** None (can start immediately)

**Status:** done

- [x] Name input is focused and its text selected when the New Pattern form opens
- [x] Width and Height inputs are clickable/tappable and bring up the numeric keyboard on phone
- [x] Width and Height each have compact up/down stepper controls
- [x] Verified on a real or emulated phone-width viewport, not just desktop

**Done (ticket 181):** NewPatternForm.vue focuses and selects the Name input in `onMounted`, found through the form's own root (`formEl.value.querySelector('#name-input')`) rather than a global id lookup, since a phone and a wider tier can both have a copy of the form mounted at once (one hidden by CSS). NumberField.vue (`form/NumberField.vue`) gained an optional `stepper` prop: a compact up/down column (Icons v2 `chevron-up`/`chevron-down`, 22px wide) beside the field, narrower than the design system's Stepper card (its wide − and + buttons didn't fit this form's narrow sidebar column, tried first and replaced after a phone-width check showed the field squeezed to a few px). Each click moves the value by the field's own `step` (1 for beads, mm and cm), clamped to `min`; the down button turns away at the minimum, matching the Stepper card's own rule. Width and Height turn it on with their own decrease/increase labels (`t.form.decrease/increaseWidth/HeightButton`, EN and RU). The numeric keyboard already worked (`inputmode`, ticket 149); no separate fix was needed there. Verified with Playwright at a phone viewport (iPhone 13 emulation): the Name input auto-focuses inside the phone's New Pattern sheet, and a stepper tap updates the field.
