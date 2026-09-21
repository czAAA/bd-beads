# 79: Responsive: phone/tablet breakpoints

**What to build:** Make the app shell, Toolbox, and canvas panel usable at phone and tablet sizes (primary target), including iPad 8″ and iPad 10–14″.

**Blocked by:** 75 (Apply design system to Toolbox & Tool groups), 76 (Apply design system to messages/popups)

**Status:** ready-for-agent

**Note (performance plan, ADR 0018):** phone and tablet are where speed matters most. Ticket 103's performance check (throttled to stand in for a midrange Android tablet) is the pass/fail measure for drawing, hover and painting at the sizes this ticket targets; layout changes here must not slow the Drawing surface or make it redraw more often (for example, avoid resizing it on every scroll frame).

- [ ] App shell layout adapts correctly at phone and both named iPad sizes
- [ ] Toolbox and Tool groups remain usable (reachable, tappable) at these sizes
- [ ] No horizontal scrolling or clipped controls at any of the target sizes
