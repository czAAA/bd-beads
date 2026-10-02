# 214: Escape switches to Paint from any tool

**What to build:** Pressing Escape while Fill, Select or Eraser is the active tool makes Paint the active tool. Escape's existing dismissals keep priority (closing a Toolbox disclosure or hover-expanded group, clearing a Selection, dismissing the paste preview and click-to-stamp); only an Escape that has nothing else to dismiss switches the tool.

**Blocked by:** None (can start immediately)

**Status:** done

**Overview / Tour:** asked; not added to either (small polish change).

- [x] With Fill, Select or Eraser active and nothing to dismiss, Escape makes Paint active
- [x] With something to dismiss (open disclosure, expanded group, Selection, paste preview), Escape dismisses it and leaves the tool alone; a further Escape then switches to Paint
- [x] Escape with Paint already active does nothing new
- [x] Escape typed into a text field or while a modal is open keeps its current behavior
- [x] The keyboard shortcuts list mentions Escape selecting Paint
- [x] CONTEXT.md's Selection/Paste wording about Escape stays accurate
