# ColorPickers

The Custom colour button. It sits at the foot of the colour popover (ToolPill card).

- Custom expands a picker the app draws, inside the colour popover under the buttons (no separate popover or sheet), the same on every device. It holds a round colour wheel (`--color-wheel-size`, 200px: hue is the angle, saturation the distance from the centre), a brightness slider (`--color-slider-height`), a preview swatch and a hex field (a TextField, `#rgb` or `#rrggbb` with or without `#`; an invalid entry shows the `danger` border and a short Note, and snaps back to the current colour on blur). The thumbs are `--color-thumb-size` (18px) with a `panel` edge and the `ring`. Wheel and slider are `role="slider"`, the wheel reading "hue 210°, saturation 60%"; arrows move them (Shift for ten times the step), Tab goes wheel, slider, hex.
- The picker previews only: the paint colour, the pill and the Palette change when it is left. A press outside it (ADR 0061) takes the colour once and closes it with the colour popover; Enter does the same; Escape leaves without taking it and returns focus to the button. Opened and left untouched, it takes nothing. It opens on the slot's Custom colour, else the paint colour, else a mid red. The button always shows the hatched square (the chosen colour is the paint colour, shown in the Palette). Selected: the `ring`, like a Palette swatch.

- **Elsewhere (tickets 0537, 0653).** The same button and picker serve the Convert image wizard's Remap (FoundColorRow card) and the Canvas color's background color picker (CanvasBackground card), where a press on that picker's swatches picks the swatch and takes nothing, as a Palette swatch does here. The selected ring's gap is the surface the button sits on (`--swatch-gap`, as for AppSwatch).
- **The margin (ticket 0655).** The Frame's margin color uses the same Custom color tile and picker, inside the BackgroundColorPicker of the Frame panel's margin section and of the margin's Margin color popover (MarginSheet card).

Hand-written from the Phase A sign-off (forms, screens and states); static rendition.
