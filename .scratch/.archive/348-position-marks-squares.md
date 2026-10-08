# 348: Squares style for Position marks

**What to build:** A Dots | Squares choice for Position marks, kept as a preference on the device. Squares draw a 1 CSS px outline in the gap round each empty position outside the Frame and its keep-out margin, clear inside, with the Technique's bead corner radius and its half-bead row shift. The toggle sits in the Canvas color popover under the swatches (shared controls and registry, no shortcut). In high contrast the Canvas color button comes back and opens the toggle alone. A new `position-mark` token, starting from `bead-empty`, is used by both styles. Update the design system in the same commit: BeadBoard and Canvas color cards, tokens, bundle and design values, plus a changelog line. See the spec for the user stories and tests.

**Spec:** 347 (Position marks without the zoom-out freeze)

**Blocked by:** 347

**Status:** done

- [x] Squares tile: an outline in the gap, clear inside, with the Technique's corner radius, aligned with the beads at every rotation
- [x] Dots stays the default; the choice applies at once, is stored on the device and is never saved with a Project or exported
- [x] Toggle in the Canvas color popover (and wherever it sits in the phone Menu sheet); high contrast shows the button with the toggle alone
- [x] `position-mark` token in light, dark and high contrast, used by Dots and Squares
- [x] Design-system cards, tokens, bundle, design values and changelog updated in the same commit
- [x] The tests related to the changed files pass; add Squares visual baselines
- [ ] Hand check on the iPad Air 13" and the desktop PC
