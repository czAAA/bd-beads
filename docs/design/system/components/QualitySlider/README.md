# QualitySlider

A three-stop discrete slider: **Export quality**, under the Picture and Printable chart buttons in the Frame panel's export section. One choice drives both exports.

## Where it sits

- In the Frame panel (`panel-width`, 448px), the last row of the **export** PanelSection, below the Picture (`.png`) and Printable chart (`.pdf`) rows, `space-8` under the last button and inside the section's padding. The section header and its collapse behave as every PanelSection (remembered per device); the collapsed summary does not mention quality.
- Head line: "Export quality" (Inter 500 13, `ink`) and, right-aligned, the chosen stop's word in `meta-small` (`muted`).

## Stops

| Stop | Picture (PNG) | Printable chart (PDF) |
| --- | --- | --- |
| Low (saves memory) | 45 px per bead | 150 DPI |
| **Medium** (default) | 60 px per bead | 300 DPI |
| High | 90 px per bead | 450 DPI |

Both exports follow it. The choice is remembered per device. `print-dpi` (150) is the Low PDF value; `print-png-bead` (60px) is the Medium PNG value.

## Parts

- A native `<input type="range" min="0" max="2" step="1">`, so touch drag, arrow keys, Home and End work by default (one tab stop). Accessible name "Export quality"; `aria-valuetext` reads the stop's word and both estimates, e.g. "Medium, picture about 12 MB, chart about 3 MB".
- Track `slider-track` (4px, `radius-full`) in `track`; the filled part up to the thumb in `accent`. Thumb `slider-thumb` (20px) in `ink` with a 2px `canvas` ring. The input is `touch-target` (44px) tall, so the hit area meets 44px; the stops row is pulled up under it.
- Under the track, one button per stop (`role="radio"` in a `radiogroup`, mirroring the range value), each at least `touch-target` tall and centred under its thumb position, so a tap on a label moves the thumb. Each holds: the word (Inter 500 13), then `45 px · 150 DPI` (DM Mono 12, `muted`), then the estimate for each format, `PNG ≈ 12 MB` and `PDF ≈ 3 MB`, computed for the open Frame. Estimates are approximate: always "≈", never to the digit.
- Stops are the only ticks; no extra tick marks are drawn.

## States

| State | Look |
| --- | --- |
| Default | As above; the chosen stop's word in `ink`, the others in `body`. |
| Hover | Thumb `accent-strong`; a hovered stop button gets `hover-fill`. |
| Focus-visible | `focus-ring` (`ink`, ADR 0075), `focus-width`, 2px *outside* the thumb (inside it the ring would vanish into the `ink` thumb); a stop button gets the ring just inside its edge (`focus-offset`), like every control. |
| Dragging | Thumb `accent-strong`, scaled by `slider-thumb-scale` (1.15); the value snaps stop to stop (no in-between). |
| Disabled | While an export runs: thumb `faint`, filled part `accent-disabled-bg`, labels and estimates `faint`, no hover. The buttons for the export are disabled with it (SaveStates card). |
| Scaled down | A stop whose bead size was reduced for this Frame (the pixel ceiling) shows both values, `60 px → 41 px`, the second in `accent-strong`; an `info` button beside it opens the panel's Tooltip: "Reduced to fit the largest picture a browser can make for this Frame." The estimate is for the reduced size. |
| Unavailable | A stop the device cannot make (PDF 450 DPI on phones) is absent: the slider has two stops (`--qs-n` is 2, each half the width) and one `meta-small` line says "High is 300 DPI on this device." The saved choice High maps to the last stop shown. |

## Layout and text

- Fits the 448px panel and a 320px viewport (the panel is narrower than `panel-width` on a phone): at 288px the three columns are about 96px each; nothing is a fixed width. A word never breaks inside itself (`overflow-wrap: break-word` only for a word wider than its column); the figures (`DM Mono`) never wrap, the words and lines wrap under the stops. If a translated word is long ("Estimaciones", "Низкое"), the column grows taller, never wider.
- Seven languages (be, ru, uk, pl, es, zh, en): the words are Low, Medium, High (each with "saves memory" in the head's Tooltip, not in the column), "Export quality", "PNG" and "PDF" stay in Latin letters, and "≈" and "MB" follow the language's unit word. The note under two stops wraps to two lines at 320px.
- Light, dark and contrast themes: the track gets a 1px `panel-line` inset in contrast; the filled part and thumb keep 3:1 against the track in all three.

## Notes

- Accessibility: the range is the control; the stop buttons are a pointer convenience and carry `tabindex="-1"` so the slider stays one tab stop. The estimates are in `aria-valuetext`, not read twice.
- Hand-written, repo-owned from the start (not from claude.ai); static rendition with `.qs-*` rules in `components/bundle.css`. `slider-thumb-scale` is a value, not a token (`design-values.css`).
