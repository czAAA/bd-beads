# SegmentedControl

Two or three always-visible choices: Technique, Unit, Change from.

- For 2–3 choices that are always visible: Technique, Unit, Change from. 2px inset, options 34px (28px small), radius 6 inside radius-md.
- Selected: `ink` fill with `canvas` text, like the theme toggle. Words in Inter; values and units in DM Mono.
- Arrow keys move between options; it is one tab stop (`role="radiogroup"`).
- An option may carry a **warning** (ticket 0768; ConvertImage card, the AI chip's warning dot): a `--ai-warning-dot` dot in `warning` at its top right, ringed 1.5 px in the option's own fill, and the warning sentence as its accessible description (`aria-describedby`, a hidden element), so the dot is never the only sign. The option stays enabled.

**In the panels (ticket 0553):** a setting with three or more choices is a PanelPicker (MenuPanel card), not a SegmentedControl. A SegmentedControl stays for a two-choice toggle on a row (a Custom frame's Fringe style, the key hints), small, at `picker-height`.

Hand-written from the Phase A sign-off (forms, screens and states); static rendition.
