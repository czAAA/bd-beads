# 250: Icon-only Tool buttons with key badges and Eraser `E`

**What to build:** The Tools group drops the text labels and the tab look. Each tool is a square icon button, four to a row (the Tool group rule), with the active tool in the accent colour, wherever tools appear: the Toolbox, the BottomToolbar and the phone tool sheet (the Dock keeps its text labels). A tool with a single-key shortcut shows that key as a small badge in the button's corner: `1` Paint, `2` Fill, `3` Select, and `H` Hand and `F` Set Frame from ticket 233. Eraser gets its own key, `E`, so it is no longer the odd one out (`Del` keeps working). Badges are hidden on touch and phone, where there is no keyboard. The name stays as each button's accessible name, so screen readers still announce it. Hovering still shows the existing name-and-shortcut hint; ticket 251 replaces it with the Tooltip.

Spec: the design system's ToolTabs and Toolbox cards (as updated by 233); if they still describe labelled tabs, update the design system on claude.ai first and copy it in (`DESIGN.md` §6).

**Blocked by:** 233 (open canvas and frame, which adds Hand and Set Frame and rewrites these components) and 249 (pencil icon).

**Status:** ready-for-agent

- [ ] The Tools group shows icon-only square buttons, four to a row, no text labels; the active tool is accent-coloured and `aria-pressed`
- [ ] The group keeps one Tab stop with arrow-key movement between tools (ticket 159)
- [ ] Remove line stays a separate text button under the group, unchanged
- [ ] Each tool's accessible name is its English or Russian label, announced by screen readers
- [ ] Single-key tools show their key badge: 1, 2, 3, H, F, E; Eraser's `Del` does not appear as a badge
- [ ] Pressing `E` activates Eraser from anywhere the other tool keys work (not while typing in a field); `Del` still erases a Selection or activates Eraser
- [ ] The shortcuts help lists Eraser with `E` beside `Del`; the hint on the Eraser button shows `E`
- [ ] Key badges are hidden on a coarse pointer and on phone
- [ ] The BottomToolbar and phone tool sheet use the same icon-only buttons; the Dock keeps its labels
- [ ] Correct at all five screen sizes and in the light, dark and high contrast themes; Russian needs no extra width now that labels are gone; design system tokens only
- [ ] Tests and visual snapshots for the Toolbox, BottomToolbar, Dock and shortcuts help are updated
- [ ] CONTEXT.md: the Eraser entry names `E`; Tool button is already defined
- [ ] Overview and Tour question (CLAUDE.md): asked of the user; answer: no Overview tile; Tour steps that point at tools only need a wording check
