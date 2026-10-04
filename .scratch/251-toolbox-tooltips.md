# 251: Tooltip on the Toolbox buttons

**What to build:** Hovering (or long-pressing on touch) a Toolbox button shows the design system's Tooltip instead of the browser's native `title`: a bold name, the shortcut as a key chip and, only where the control needs one, a description line. It applies to every Tool button and to the other Toolbox buttons (Undo, Redo, Rotate, Copy, and the Mirror and Size controls). Header and dialog buttons stay as they are.

Descriptions, in English and Russian, worded to the design system's writing rules:
- **Paint:** click or drag to paint; right-click erases.
- **Fill:** fills the connected area; right-click erases it.
- **Select:** drag to mark an area, then copy and paste it.
- **Hand:** drag to move around the canvas.
- **Set Frame:** drag to mark which beads are the Pattern.
- **Eraser:** no description.

A disabled control shows no tooltip (forms-and-states). The Tooltip never takes focus or clicks and sits on the tooltip layer above everything.

**Blocked by:** 250 (icon-only Tool buttons).

**Status:** ready-for-agent

- [ ] Every Tool button shows the Tooltip on hover and on keyboard focus: name, shortcut chip, and a description for Paint, Fill, Select, Hand and Set Frame
- [ ] The Eraser tooltip has name and `E` only
- [ ] Undo, Redo, Rotate, Copy and the Mirror and Size controls show name and shortcut in the same Tooltip; no Toolbox button still relies on a native `title`
- [ ] On touch, a long-press shows the Tooltip; a plain tap still just selects the tool
- [ ] A disabled control shows no Tooltip
- [ ] Escape dismisses it; it stays within the viewport at every screen size, including next to the 200px Toolbox rail edge
- [ ] Shortcut chips match the key shown in the shortcuts help; Ctrl/Cmd chords show as written there
- [ ] Copy in English and Russian; correct in the light, dark and high contrast themes; design system tokens only
- [ ] If the design system's Tooltip card lacks a description line or key chip, add it on claude.ai first and copy it in (`DESIGN.md` §6)
- [ ] Tests for the Toolbox are updated; the Tour's existing steps that point at tools are checked for wording and for the Tooltip not covering the highlighted control
- [ ] CONTEXT.md already defines Tooltip; confirm it still matches what was built
- [ ] Overview and Tour question (CLAUDE.md): asked of the user; answer: no Overview tile; Tour needs only the wording check above
