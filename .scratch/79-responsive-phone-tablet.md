# 79: Responsive: phone tier

**What to build:** The phone layout from `docs/design/system/responsive.md` (0–743px): the screen belongs to the Pattern and the Progress bar. A 52px header with the mark, the Pattern name with its size and save state, Undo, Redo and a More menu (theme, language, name on exports, keyboard shortcuts, import). No canvas strip: pinch to zoom and pan, with a small zoom pill in the Pattern's bottom-right corner. The Progress bar is the largest control, with Row done as a wide primary button. A dock of six buttons (the active tool, Color, Edit, Mirror, Size, Pattern) each opens its own bottom sheet with every option of that kind, so nothing the desktop has is missing. The Selection context bar sits above the Progress bar. A phone on its side (height under 500px) moves the dock to a 64px rail on the left and the header to 44px.

**Blocked by:** 168 (Responsive: iPad mini tier)

**Status:** ready-for-agent

**Note (performance plan, ADR 0018):** phone and tablet are where speed matters most. Ticket 103's performance check (throttled to stand in for a midrange Android tablet) is the pass/fail measure for drawing, hover and painting at the sizes this ticket targets; layout changes here must not slow the Drawing surface or make it redraw more often (sheets slide with `transform`, the surface resizes only once the layout settles).

- [ ] Matches the Dock, ToolSheet, ZoomPill, ContextBar, OverflowMenu, PhoneForms and ScreenSizes cards at 390, 402, 420 and 440px wide, portrait and landscape
- [ ] Every desktop feature is reachable from the dock, its sheets or More
- [ ] Tool, Color, Edit, Mirror and Size sheets have no scrim and are only as tall as their content; the Pattern sheet is modal; tapping the Pattern or the dock button again closes a light sheet
- [ ] New Pattern and other forms use 48px buttons and fields as the PhoneForms card shows
- [ ] Nothing below 12px; long Pattern names truncate with an ellipsis
- [ ] No horizontal scrolling or clipped controls at any target size, in English and Russian
- [ ] Correct in the light, dark and high contrast themes
