# InteractionStates

Every interactive component at rest, hovered, pressed, focused, disabled and selected; the samples are live.

- Hover (only with a mouse or trackpad, `@media (hover: hover)`): one step of fill, `--hover-fill` (`surface` light, `elevated` dark); primary goes to `accent-hover`; fields and in-box buttons darken their border; tabs and segments brighten to `ink`; links underline.
- Pressed: one more step, `--press-fill` (`line` light, `line-strong` dark), and a slight shrink (98% buttons, 92–94% swatches and Dock buttons) for `--duration-instant`. On touch it is the only feedback, so it is never skipped.
- Focus (`:focus-visible`, keyboard only): the 2px `focus-ring`, 2px away, on everything; fields also take an `ink` border.
- Disabled: `faint`, no hover or press, `cursor: not-allowed`; the reason written nearby.
- Selected: `accent-strong` (active tool, open Saved Pattern), `ring` (swatches), `ink` fill (segments, theme toggle), `panel` (the Dock button whose sheet is open).

Hand-written from the Phase B sign-off; the classes live in `components/bundle.css` (`ix-*`).
