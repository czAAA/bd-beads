# ColorPickers

The Image colors popover and the Custom colour button. Both sit at the foot of the colour popover (ToolPill card).

- Image colors opens a popover under its button: the colours found in the source picture (up to 14) as a 7-column grid, the chosen one with the `ring`. Escape or a click outside closes it.
- Custom expands a picker the app draws, inside the colour popover under the buttons (no separate popover or sheet), the same on every device. It holds a round colour wheel (`--color-wheel-size`, 200px: hue is the angle, saturation the distance from the centre), a brightness slider (`--color-slider-height`), a preview swatch and a hex field (a TextField, `#rgb` or `#rrggbb` with or without `#`; an invalid entry shows the `danger` border and a short Note, and snaps back to the current colour on blur). The thumbs are `--color-thumb-size` (18px) with a `panel` edge and the `ring`. Wheel and slider are `role="slider"`, the wheel reading "hue 210°, saturation 60%"; arrows move them (Shift for ten times the step), Tab goes wheel, slider, hex.
- The picker previews only: the paint colour, the pill and the Palette change when it is left. A press outside it (ADR 0061) takes the colour once and closes it with the colour popover; Enter does the same; Escape leaves without taking it and returns focus to the button. Opened and left untouched, it takes nothing. It opens on the slot's Custom colour, else the paint colour, else a mid red. The button always shows the hatched square (the chosen colour is the paint colour, shown in the Palette). Selected: the `ring`, like a Palette swatch.
- Image colors is `faint` when the Pattern has none, and says why on hover or long-press (new copy, proposed).

Hand-written from the Phase A sign-off (forms, screens and states); static rendition.
