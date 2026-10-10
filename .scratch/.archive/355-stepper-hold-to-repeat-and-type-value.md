# 355: Steppers repeat while held and let you type the value

**What to build:** Every increase/decrease input (the − value + Stepper, used for the Frame width and height and in the image-convert Frame, and the compact up/down stepper on the New Project form's number fields) gets two behaviours:

1. **Hold to repeat.** Pressing and holding a step button (mouse, touch or keyboard) steps once straight away; after a short delay it keeps stepping and speeds up, until release, pointer leave or reaching the min/max. A held press never also fires an extra step when released.
2. **Tap the value to type it.** On the − value + Stepper, clicking or tapping the visible number turns it into a numeric input (numeric keypad on touch). Enter or blur commits, Escape cancels, an out-of-range value is clamped to min/max, and empty or invalid input reverts. The number looks the same as today when not being edited. A disabled or locked stepper cannot be edited. The number is reachable by keyboard and has an accessible name. (The New Project number fields already accept typing, so they only get hold to repeat.)

**Blocked by:** None (can start immediately)

**Status:** done

- [x] Holding − or + on either stepper repeats, accelerates, and stops on release, leave, or the limit
- [x] A held press does not add a step on release; a plain click still steps exactly once
- [x] Tapping the Stepper's number lets you type a value; Enter/blur commits, Escape cancels, out-of-range is clamped, invalid reverts
- [x] Disabled/locked steppers neither repeat nor open for editing
- [x] Works with touch and keyboard, with accessible names; the resting look is unchanged
- [x] The tests related to the changed files pass; update the visual baselines only where the look changed on purpose
