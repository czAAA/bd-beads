# 21: Move editing tools above the canvas

**What to build:** Relocate the tool picker, palette, undo, mirror controls, and row progress out of the left main panel into the above-canvas panel, as a second horizontal row below the existing "New Pattern"/zoom-controls row. Each functional group renders as its own small card in that row, on a dot-grid notepad-paper background. Once a Pattern is open, the left main panel renders nothing (it keeps its New Pattern form role only when no Pattern is open). See [ADR 0005](../docs/adr/0005-tools-above-canvas.md).

**Blocked by:** None

**Status:** ready-for-agent

- [ ] Tool picker, Palette, Undo, Mirror controls, and Row progress render in the above-canvas panel, not the left main panel, while a Pattern is open
- [ ] These controls render as a second row below the existing New Pattern / zoom-controls row
- [ ] Each functional group (tool picker / palette / undo / mirror / row progress) is visually grouped as its own small card
- [ ] The row has a dot-grid (evenly spaced dots) background texture
- [ ] The left main panel renders nothing while a Pattern is open (no "coming soon" placeholder)
- [ ] The left main panel still shows the New Pattern form when no Pattern is open, unchanged
- [ ] The canvas area reclaims the width freed by the collapsed left panel
