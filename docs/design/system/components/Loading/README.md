# Loading

The waiting indicators: three beads, or a progress line when the share done is known.

- Three beads that swell in turn, in `accent`, for waits without a known length (opening a large Pattern); a 4px Progress bar track with `--track-fill` when the share done is known (converting a picture, building a PDF).
- Shown only after 300ms, so fast work never flashes. With reduced motion the beads stand still. The text says what is happening (new copy, proposed).
- Also the page's splash before the app loads (ticket 69): the three beads, centred, inline in `index.html` on the theme background, with no text, appearing only after 300ms; orange in the light theme, yellow in the dark.

Hand-written from the Phase A sign-off (forms, screens and states); static rendition.
