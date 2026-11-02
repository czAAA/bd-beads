# ValueSlider

A slider that picks one whole number over a range and writes the value above it: the Convert image wizard's Width and Colors (ConvertImage card, ticket 0747). It has QualitySlider's track and thumb, but it moves through every whole number in its range rather than between three stops, and it may carry marks.

Designed in the ticket 0747 session (claude.ai canvas "Convert image wizard · sliders", https://claude.ai/artifact/W8sTQApy6JYsF2RBkGFdDA).

## Parts

- **Head line:** the name in `control` (Inter 500 13, `ink`), and right-aligned the value in `meta` `ink`. Where the consumer gives a second unit, it follows in `meta` `muted` after " · " ("32 beads · 51 mm"). The value never wraps.
- **The range:** a native `<input type="range">`, step 1, its min and max from the consumer, one Tab stop. Arrows step 1, Page Up and Page Down a tenth of the range (at least 1), Home and End go to the ends. `aria-valuetext` is the head's value in words, both units ("32 beads, 51 mm"), and on a mark what the mark means (the consumer's words, "1 bead = 8 × 8 px").
- **Track, filled part and thumb** as QualitySlider: `slider-track` (4px, `radius-full`) in `track`, the filled part in `accent`, the thumb `slider-thumb` (20px) in `ink` with a 2px `canvas` ring; the input `touch-target` (44px) tall. Its states (hover, focus-visible ring 2px outside the thumb, dragging at `slider-thumb-scale`, disabled) are QualitySlider's.
- **The ends**, `space-4` under the track, each centred under its end of the thumb's travel: the min in `meta-small` `muted`, the max in `meta-small` `ink`, written "max 256" so it reads as a limit, not a reading.
- **Hint:** optional, one line under the ends in `small` `muted`.

## Marks

- Optional. Each mark is a `--slider-mark-width` (2px) × `--slider-mark-height` (14px) bar in `line-strong`, radius 1, standing across the track at its value. It is taller than the track, so it still shows over the filled part; the thumb covers it.
- A mark may carry a label under the track, on the ends' line, in `meta-small` `muted`, centred under it ("8×8 px"). A label that would touch an end's label or another label is left out; the mark stays.
- **Settling on a mark:** a pointer drag released within `--slider-mark-snap` (6px) of a mark lands on it. Keys never snap: they step by 1 and land on marks on their way.
- Marks are drawn for the pointer and the eye; they are not separate stops for a screen reader, which hears the meaning in `aria-valuetext` when the value is on one.

## Layout and text

- Full width of its column, with the thumb's half-width kept free at each end so the ends' labels sit under the thumb's centre.
- The head's name wraps in a long language; the value, the ends and the mark labels never wrap.
- Light, dark and high contrast as QualitySlider; the marks keep 3:1 against `track` in all three (`line-strong`).

## Acceptance

- [ ] Every whole number between the ends can be reached by drag and by keys; Home and End reach the ends.
- [ ] The head and `aria-valuetext` follow the value, in both units where there are two.
- [ ] A drag released near a mark lands on it; keys step by 1.
- [ ] At 320px nothing overflows and no label overlaps another.

Hand-written and repo-owned; static rendition.
