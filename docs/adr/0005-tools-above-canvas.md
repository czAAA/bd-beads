# Editing tools live above the canvas, not in the left main panel

_Amended by ticket 35 (revised): the "New Pattern" / zoom-controls row this ADR describes as sitting above the tool strip is gone — both controls moved elsewhere ([ADR 0004](0004-three-panel-app-shell.md)'s amendment). The tool strip is now the entire above-canvas panel, not a second row below anything._

[ADR 0004](0004-three-panel-app-shell.md) assigned painting/fill/mirror tools to the left main panel. Moved instead to the above-canvas panel, as a second row below the existing "New Pattern" / zoom-controls row: the tool picker, palette, undo, mirror controls, and row progress now all render there, styled as a strip of small cards on a dot-grid notepad-paper background. This keeps the editing tools next to what they act on (useful for the mirror axis line and hover preview, which relate directly to the grid) and gives them the horizontal room the redesigned mirror controls (two axis toggles plus two "mirror current" buttons) need.

The left main panel keeps its original New Pattern form role, but while a Pattern is open it now renders nothing. This is not the ADR 0004 "coming soon" placeholder — that convention is for a panel whose feature hasn't been built yet, whereas this panel's content moved elsewhere on purpose — so it collapses instead, and the canvas area reclaims the freed width.

**Considered options**: keeping tools in the left panel (rejected — too cramped once the mirror redesign added two more buttons, and it kept the tools visually separate from the canvas they draw on).
