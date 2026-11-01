# Loading

The waiting indicators: three beads, or a progress line when the share done is known.

- Three beads that swell in turn, in `accent`, for waits without a known length (opening a large Pattern); a 4px Progress bar track with `--track-fill` when the share done is known (converting a picture, building a PDF).
- Shown only after 300ms, so fast work never flashes. With reduced motion the beads stand still. The text says what is happening (new copy, proposed).
- Also the page's splash before the app loads (ticket 69): the three beads, centred, inline in `index.html` on the theme background, with no text, appearing only after 300ms; orange in the light theme, yellow in the dark.

## AI variant (ticket 0764, ADR 0087)

The wait while a model downloads or works, in Convert image's Picture step (ConvertImage card, cut out), drawn in `ai` instead of `accent` so it says a model is at work; the word AI is never in it. It sits under the cut out row, as wide as the pane's content, and Cancel is always in it.

- **Download:** the Loading line, 4px (`track-height`) on `track`, `radius-full`, the full width, its fill solid `ai` (never `--track-fill`), growing with the bytes. Under it, on one line that wraps before it overflows: "Getting the cut-out model ready · {done} of {total} MB" in `meta` (Inter, `body`) at the left, {done} and {total} in whole MB ("12 of 44 MB"; writing.md, Numbers and units), and **Cancel**, a small text button, at the right. The same line serves the tap model's download.
- **Thinking:** the three Loading beads, compact (8px, 4 apart), in `ai`, swelling in turn, then "Finding the subject…" (and the same while a tap is worked out), and Cancel at the right, on one row. Meanwhile a **shimmer** sweeps over the preview's picture: a soft band, `--ai-shimmer-band` (40%) of the preview wide, `--ai-shimmer-fill` (`ai` at 16%, 22% in dark) fading to clear at both edges, crossing left to right in `--ai-shimmer` (1600ms, linear), then again; above the beads drawn, under the Frame line, the handles and the zoom, taking no pointer.
- **Taking longer:** once a run has gone past the threshold the iPad spike sets (ticket 0763; about ten seconds), the text becomes "Still working: this device is taking longer"; the beads, shimmer and Cancel stay.
- **As Loading already does:** nothing at all for the first 300ms (`loading-delay`), so a fast run never flashes. With reduced motion the beads stand still and there is no shimmer; the download line still fills, in steps, without a transition.
- **Cancel** stops the download or the run at once (the worker is stopped) and takes the Cut out choice back to the one before.
- `role="status"`: the text is read once when it shows and once when it changes (Taking longer); the MB count is not read as it climbs.
- In high contrast `ai` is #4a1fd1 on white (8.7:1) and the shimmer is the same 16% band.

Hand-written from the Phase A sign-off (forms, screens and states); static rendition.
