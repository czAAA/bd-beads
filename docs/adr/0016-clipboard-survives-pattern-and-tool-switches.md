# The clipboard survives a Project switch, a tool switch and cancelling; only a new Copy or Selection clears it

**Status: accepted.** Ticket 92.

Undo history and the Selection reset when another Project opens (CONTEXT.md): both are tied to one Project's beads. The clipboard (CONTEXT.md's Copy) is not. It clears only when a new Copy replaces it or a new Selection is made, and survives a Project switch, a tool switch and a cancel.

The reason is Ctrl/⌘+V: it pastes at the bead under the pointer from whichever tool is active, so a copied motif can be carried into another tool or another Project without copying it again. A copied block is only colors, portable to any Project.

Cancelling (Escape, right-click) and leaving Select still stop the *visible* paste projection, since the preview and click-to-stamp belong to Select and a stray click with another tool must never stamp. They set a dismissed flag (`pasteDismissed`, `useSelectionGesture`): returning to Select does not revive the projection, only a new Copy or Selection does. Ctrl/⌘+V ignores the flag.

**Considered options**: re-arming the projection on returning to Select (rejected: a preview appearing with no new action reads as the editor stamping on its own); a second, Select-only clipboard for Ctrl/⌘+V (rejected: two clipboards for one Copy).
