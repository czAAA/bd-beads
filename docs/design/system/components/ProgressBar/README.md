# ProgressBar

The 48px bar (ticket 411; it was 56px) along the canvas box's bottom edge holding every Row progress control. It is always shown, at every width including under 1024px, whatever the Pattern's shape.

Left to right, padding 0 12 0 16, gap 12, top divider `box-muted` at 22%:
1. **Show row progress switch:** 30 × 18, radius-full. On: `accent` track, 12px `on-accent` knob at the right. Off: `box-button-line` track, white knob at the left. `role="switch"`, named "Show row progress". Its key is `P`, and it is the only way to turn Row progress on or off (the Zoom pill has no button for it).
2. **Turn row direction:** icon button, directly beside the switch and away from the do/undo pair, so it can't be hit by accident while doing or undoing rows. Pressed while rows run left to right. Turning it shows a short success toast naming the new direction ("Rows now run top to bottom."), once per change, the `D` key included.
3. **Counter** "5/30" (`control`), then the **track:** fills the free width, 4px, radius-full, `track`, with a fill showing the finished share: `linear-gradient(90deg, #fa520f, #ffa110)` in light, `#faff69` in dark (`--track-fill` in bundle.css). Once every pass is done the track is completely full (on loom, brick stitch and peyote, in both directions) and the counter shows the last row; a pass still open never fills it.
4. **Row not done:** large (`lg`) box button with a leading up arrow and its label; moves the current row back one.
5. **Row done:** large (`lg`) primary button with the label and a trailing down arrow; marks the row finished and moves on. Disabled once every pass is done.

Row done and Row not done show text and follow Row direction: top to bottom they read "Row not done ↑" and "Row done ↓"; left to right the arrows turn to point left and right and the words become "Column not done" and "Column done" (in every shipped language). Tooltips and screen-reader names are the visible labels.

**Phone widths (30rem and under).** Row not done and Row done do not fit one row with the switch, Turn row direction and the track in every language at 360px, so they take a second row of their own, half the bar each (`type-small`), and the bar is 88px (`--progress-height` 5.5rem) instead of 48px; everything above it follows that height.

While Row progress is off only the switch and a "row progress" label show; the bar keeps its height so the canvas does not jump.

**No Frame (v16).** Row progress works on the Frame: its rows are the Frame's rows. Until a Frame is set the bar shows the switch off and disabled, "Row progress" (`control`), "Set Frame to start" (`meta`) and, right-aligned, a Set Frame button (secondary in a box, `frame` icon). Row done and Row not done are not offered. The third row of the preview.

Hand-written from DESIGN.md §5.11 and the v16 sign-off; static rendition.
