# ProgressBar

The 56px bar along the canvas box's bottom edge holding every Row progress control. It is always shown, whatever the Pattern's shape.

Left to right, padding 0 12 0 16, gap 12, top divider `box-muted` at 22%:
1. **Show row progress switch:** 30 × 18, radius-full. On: `accent` track, 12px `on-accent` knob at the right. Off: `box-button-line` track, white knob at the left. `role="switch"`, named "Show row progress".
2. **"Row 12"** (`control`, 2px extra space before), then **"of 30 · top to bottom"** (`meta`).
3. **Track:** fills the free width, 4px, radius-full, `track`, with a fill showing the finished share: `linear-gradient(90deg, #fa520f, #ffa110)` in light, `#faff69` in dark (`--track-fill` in bundle.css).
4. **Turn row direction:** icon button.
5. **Row not done:** button with a left chevron; moves the current row back one.
6. **Row done:** primary button with a check; marks the row finished and moves on.

While Row progress is off (Derived) only the switch and a "row progress" label show; the bar keeps its height so the canvas does not jump.

**No Frame (v16).** Row progress works on the Frame: its rows are the Frame's rows. Until a Frame is set the bar shows the switch off and disabled, "Row progress" (`control`), "Set Frame to start" (`meta`) and, right-aligned, a Set Frame button (secondary in a box, `frame` icon). Row done and Row not done are not offered. The third row of the preview.

Hand-written from DESIGN.md §5.11 and the v16 sign-off; static rendition.
