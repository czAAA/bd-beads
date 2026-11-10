# InteractionStates

Every interactive component at rest, hovered, pressed, focused, disabled and selected; the samples are live.

- Hover (only with a mouse or trackpad, `@media (hover: hover)`): one step of fill, `--hover-fill` (`surface` light, `elevated` dark); primary goes to `accent-hover`; fields and in-box buttons darken their border; tabs and segments brighten to `ink`; links underline.
- Pressed: one more step, `--press-fill` (`line` light, `line-strong` dark), and a slight shrink (98% buttons, 92–94% swatches and Dock buttons) for `--duration-instant`. On touch it is the only feedback, so it is never skipped.
- Focus (`:focus-visible`, keyboard only): the neutral 2px `focus-ring` (`ink`), just inside the control's edge, on everything; fields also take an `ink` border.
- Disabled: `faint`, no hover or press, `cursor: not-allowed`; the reason written nearby.
- On touch (ticket 0844): a finger has no hover, so a Tooltip opens on a long-press (half a second), and the release of a long-press that showed one presses nothing: reading a control's name never runs it. A tap on an Info button opens its note above it, clear of the control it explains, and the note stays until the next tap anywhere (a tap on the Info button again closes it); a tap on a disabled control shows its reason the same way.
- Selected: `accent-strong` (active tool, open Saved Pattern), `ring` (swatches), `ink` fill (segments, theme toggle), `panel` (the Dock button whose sheet is open).

Hand-written from the Phase B sign-off; the classes live in `components/bundle.css` (`ix-*`).
