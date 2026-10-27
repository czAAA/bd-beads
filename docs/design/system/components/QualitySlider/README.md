# QualitySlider

**Export quality** is a three-stop discrete slider under the Picture and Printable chart buttons in the Frame panel's export section. It sets the **PNG** only (ADR 0076): the PDF's chart pages are vector and its other pages a fixed 300 dpi. Each export button shows the size of what it will give in its value slot ("PDF ≈ 3.2 MB · 9 pages").

Revised in the design session of 2026-10-27 (tickets 0585, 0588; the claude.ai canvas "Printed chart pages", option A).

## Where it sits

- In the Frame panel (`panel-width`, 448px), in the **export** PanelSection, in this order: the Picture row, the Printable chart row, then the slider, `space-8` under the last button and inside the section's padding. The section header and its collapse behave as every PanelSection does (remembered per device); the collapsed summary does not mention quality or sizes.
- The slider's head line: "Export quality" (Inter 500 13, `ink`) and, right-aligned, the chosen stop's word in `meta-small` (`muted`).
- Under the stops, `space-8` below them: one `meta-small` line in `muted`, "For the picture. The printable chart is drawn in lines and stays sharp at any zoom." (writing.md).

## The size line (ticket 0588)

- Each export button (PanelItem) shows its size in its **value slot**, replacing ".png" and ".pdf", in DM Mono 12 `muted`: "PNG ≈ 1.4 MB · 2 files" and "PDF ≈ 3.2 MB · 9 pages". The format word comes first, so the extension is still there.
- The figure is the File size estimate (glossary), an upper bound. It is rounded **up** to 0.1 MB ("≈ 0.3 MB"); under 0.1 MB it reads "< 0.1 MB" with no "≈"; from 10 MB it is whole MB, rounded up ("≈ 12 MB").
- The count is every file or page the button gives: "1 file", "2 files"; "4 pages", "9 pages", with singular and plural from the language.
- The PNG line follows the slider's stop. The PDF line follows only the Frame, Letters (the Word chart pages) and the colors (list pages).
- With no Frame the buttons are disabled and the value slot shows ".png" and ".pdf" as before.
- At narrow widths, a value that does not fit beside its label moves under it as a second line, left-aligned with the label, never truncated. The figures never wrap inside themselves.

## Stops

| Stop | Picture (PNG) | Estimate under the stop |
| --- | --- | --- |
| Low (saves memory) | 150 DPI | the PNG at 150 DPI, e.g. "≈ 0.4 MB" or "< 0.1 MB" |
| **Medium** (default) | 300 DPI | "≈ 1.4 MB" |
| High | 450 DPI | "≈ 2.9 MB" |

The PDF is not on the slider: its picture pages (Cover, list pages, Specification, Word chart) and the text picture under each chart page are 300 dpi (`print-dpi`), or 150 where a device cannot allocate a 300 dpi page. The choice is remembered per device; `print-png-bead` (60px) is the Medium PNG value.

## Parts

- A native `<input type="range" min="0" max="2" step="1">`, so touch drag, arrow keys, Home and End work by default (one tab stop). Accessible name "Export quality"; `aria-valuetext` reads the stop's word and the picture's estimate, e.g. "Medium, picture about 1.4 MB".
- Track `slider-track` (4px, `radius-full`) in `track`; the filled part up to the thumb in `accent`. Thumb `slider-thumb` (20px) in `ink` with a 2px `canvas` ring. The input is `touch-target` (44px) tall, so the hit area meets 44px; the stops row is pulled up under it.
- Under the track, one button per stop (`role="radio"` in a `radiogroup`, mirroring the range value), each at least `touch-target` tall and centred under its thumb position, so a tap on a label moves the thumb. Each holds the word (Inter 500 13), then `150 DPI` (DM Mono 12, `muted`), then the PNG estimate for the open Frame (DM Mono 12, `muted`), "≈ 1.4 MB" with no "PNG" in front.
- Stops are the only ticks; no extra tick marks are drawn.

## States

| State | Look |
| --- | --- |
| Default | As above; the chosen stop's word in `ink`, the others in `body`. |
| Hover | Thumb `accent-strong`; a hovered stop button gets `hover-fill`. |
| Focus-visible | `focus-ring` (`ink`, ADR 0075), `focus-width`, 2px *outside* the thumb (inside it the ring would vanish into the `ink` thumb); a stop button gets the ring just inside its edge (`focus-offset`), like every control. |
| Dragging | Thumb `accent-strong`, scaled by `slider-thumb-scale` (1.15); the value snaps from stop to stop, with nothing in between. |
| Disabled | While an export runs: thumb `faint`, filled part `accent-disabled-bg`, labels and estimates `faint`, no hover. The export buttons are disabled with it (SaveStates card). |
| Unavailable | A PNG page the device cannot allocate (450 DPI on some phones and tablets, found by trying, ticket 0572) is not offered: High is drawn at 300 DPI, its stop shows `300 DPI`, and one `meta-small` line under the note says "High is 300 DPI in the picture on this device." The slider keeps three stops. |

## Layout and text

- Fits the 448px panel and a 320px viewport (the panel is narrower than `panel-width` on a phone): at 288px the three columns are about 96px each; nothing is a fixed width. A word never breaks inside itself (`overflow-wrap: break-word` only for a word wider than its column); the figures (`DM Mono`) never wrap, while the words and lines wrap under the stops. A long translated word ("Estimaciones", "Низкое") makes its column taller, never wider.
- Seven languages (be, ru, uk, pl, es, zh, en): the words are Low, Medium, High (each with "saves memory" in the head's Tooltip, not in the column), "Export quality", and the note. "PNG" and "PDF" stay in Latin letters; "≈", "MB", "files" and "pages" follow the language.
- Light, dark and contrast themes: the track gets a 1px `panel-line` inset in contrast; the filled part and thumb keep 3:1 against the track in all three.

## Acceptance

- [ ] The slider changes the PNG only. A PDF made at Low, Medium and High is the same file, apart from its date.
- [ ] The stops show the word, the DPI and "≈ n MB" (or "< 0.1 MB") with no format word. `aria-valuetext` names the picture's estimate only.
- [ ] Picture's value slot reads "PNG ≈ {size} · {n} files" and Printable chart's reads "PDF ≈ {size} · {n} pages", with the counts equal to the files and pages the buttons give.
- [ ] Sizes are rounded up to 0.1 MB, "< 0.1 MB" under 0.1 MB, and whole MB from 10 MB. Nothing ever shows a floor of "1 MB".
- [ ] The note "For the picture. The printable chart is drawn in lines and stays sharp at any zoom." sits under the stops. In the Unavailable state the High line follows it.
- [ ] At 320px, a value that does not fit moves under its label, and nothing is cut off or overflows.
- [ ] Every string is translated in the seven languages, and Text fit passes.

## Notes

- Accessibility: the range is the control; the stop buttons are a pointer convenience and carry `tabindex="-1"`, so the slider stays one tab stop. The estimate is in `aria-valuetext`, so it is not read twice.
- Hand-written and repo-owned from the start (not from claude.ai); static rendition with `.qs-*` rules in `components/bundle.css`. `slider-thumb-scale` is a value, not a token (`design-values.css`).
