# Glossary: Toolbox and controls

The Toolbox and the controls and surfaces around it. Part of the glossary split out of `CONTEXT.md` (ticket 380); the index is [README.md](README.md).

**Toolbox**:
The fixed-width rail of editing controls down the left of the app shell while a Project is open (no wider than 200px, thinner on a tablet), made up of Tool groups stacked vertically. Takes the left column in turn with the New Project form. Stays pinned near the top of the viewport while the canvas is in view, so it stays reachable while working on the lower rows of a Project taller than the screen, and un-pins once the canvas has scrolled past.
_Avoid_: tool strip, toolbar, above-canvas panel

**Tool group**:
One titled box within the Toolbox gathering related controls — e.g. Tools (Paint, Fill, Select, Eraser), Colors, Edit (including Save and PNG and PDF export), Mirror, Size. Lays its controls out four to a row (three on a tablet) and holds at most 16 in view (four rows of four); a group with more shows that it has more and expands in place, downward, while the pointer is inside it.
_Avoid_: subbox, card, section, panel

**Dock layout**:
The main layout at every width (ADR 0046): the canvas first, the Dock below it (about 480px wide, centred), sheets for the controls, the slim Canvas strip always visible; no header, no left column, no Toolbox. Chosen by `DOCK_LAYOUT_ENABLED`.
_Avoid_: phone layout, mobile layout, touch layout

**Toolbox layout**:
The wide layout kept behind `DOCK_LAYOUT_ENABLED = false`: from 1024px a header, the left column with the Toolbox, and the canvas box; under 1024px it is the Dock layout (ADR 0032).
_Avoid_: desktop layout, wide layout

**Dock**:
The bottom bar of the Dock layout, at every width (phones, iPads and desktops alike, portrait and landscape; ADR 0032, 0046), with no header above the canvas. Five slots, each opening its own sheet: Tool, Colour, Frame (which also holds Rotate, Copy and Paste), Project, Menu. icon-only with no labels, 48px tall plus the safe-area inset; at most about 480px wide, centred. With no Project open, a New Project / Import bar takes its place, with the Menu button still at the bottom right.
_Avoid_: toolbar, rail, tab bar

**Menu**:
The Dock's last slot: a modal sheet of app-wide settings and links (language, theme, Name on exports, Keyboard shortcuts, Overview, the source link). Everything about the open Project lives in the Project sheet instead.
_Avoid_: More, header menu

**Zoom pill**:
The movable pill floating over the canvas under 1024px: Rulers, Undo, Redo, the Row progress button, zoom out, the zoom level, zoom in, Fit. Dragging it from anywhere on it (past about 6px; a tap still presses the button) moves it anywhere inside the canvas box, and it stays exactly where it is dropped, with no snapping; Alt + an arrow key nudges it a step. It is always fully visible: when the canvas box shrinks or the screen turns it is pulled back inside, and it keeps its relative place when the box grows again. The position is kept on the device. Its Row progress button is the same action as the Progress bar's switch (`P`), not a separate show/hide: turning it on turns Row progress on and shows the Progress bar, turning it off turns Row progress off and hides the bar. The bar cannot be hidden while Row progress stays on.

**Tool button**:
A Tools-group tool shown as an icon-only tab (Paint is a pencil), 56px wide, five to a row, selected by an accent underline, with no text label: its name, its shortcut and, where the tool needs one, a one-line description appear in its Tooltip. Every tool has a digit key, 1 to 6 in the order Paint, Fill, Select, Eraser, Hand, Frame (7 to `=` are left free for later tools; ticket 292), shown as a small badge beside the icon on every device. The letters E, H and F no longer pick tools. The name stays as the button's accessible name.
_Avoid_: tab, tool tab

**Tooltip**:
The design system's hover, keyboard-focus and long-press (on touch) help for a control: a name (always), the shortcut as a key chip (optional) and a description line (optional). Any control may have one, icon-only or labelled: a control shows a Tooltip exactly when one is given to it, with no other condition. It replaces the browser's native title everywhere. A disabled control's Tooltip says why it is disabled. It is not an (i) button that has to be clicked; always-visible help text is a Note. A Tooltip is never clipped (ticket 265): its bubble opens in the browser's top layer, outside every column, sheet and canvas that holds its button, on the side of the button that has room (above near the bottom of the screen, below near the top), inside the screen on all four edges, and wraps at a maximum width (the wide-tooltip measure, 15rem) instead of running in one long strip.

**Note**:
A thin, always-visible gray block of helper text under a control or panel (for example the Estimated size or the Bead quantities explanation). It replaces every (i) button that had to be clicked to show its text.
_Avoid_: info tip, (i) popup, hint
