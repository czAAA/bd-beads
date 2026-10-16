# Glossary: Tool pill and controls

The Tool pill and the controls and surfaces around it. Part of the glossary split out of `CONTEXT.md` (ticket 380); the index is [README.md](README.md). The Toolbox, the rail of controls that sat in the left column, is gone (ticket 412): its controls live in the Tool pill, the Context bar, the Project and Menu sheets and the Canvas strip (the Zoom pill is gone, ticket 425).

**Tool group**:
A titled set of related controls — Tools (Paint, Fill, Select, Piece, Eraser, Hand; Select all is not a Tool: it is the Selection bar's first item and Ctrl/⌘+A, tickets 414, 428, 439), Colors, Edit, Mirror, Row progress. The Tool pill, the sheets and the keyboard shortcuts help gather the same controls under the same names.
_Avoid_: subbox, card, section, panel

**Tool pill layout** (formerly **Dock layout**):
The main layout at every width (ADR 0046, ADR 0059): the canvas box is the screen, 6px from every screen edge, with the Canvas strip on top, the drawing area and the Progress bar as its footer, and the Tool pill floating over the drawing area; sheets for the controls; no header, no left column. Menu and Project open from the Canvas strip (ticket 431). It is the only layout (ticket 412 removed the Toolbox layout and its flag; ticket 439 removed the Dock).
_Avoid_: phone layout, mobile layout, touch layout, Dock layout

**Tool pill** (replaces the retired **Dock**):
The tools as a pill floating over the drawing area (ticket 439, ADR 0059; ToolPill card), 6px in from the edge it is docked to and centred along it, outside the canvas's zoom so it never zooms. Order, from its leading end: the grip ("Move tools"), six tool tiles (Paint, Fill, Select, Piece, Eraser, Hand), a divider, the colour control and, where the device needs it, a second divider and the Pen/Mouse toggle. A tile picks its tool at once; there is no Tool sheet. Icon-only, 48px across, 40px tiles, a `toolbar` named "Tools". It docks to the left, top, right or bottom (default bottom, vertical on the sides): dragged (after 8px, with four drop zones, the nearest edge snaps), moved with the grip's arrow keys, or set in the Menu sheet's "Tools position"; the choice is kept on the device. Longer than its edge (a phone), it scrolls along its length. The colour control is one swatch tile (One color, the default) or the swatch, three recents and a palette tile (Recent colors; eight recents are kept on the device, a pick moves to the front), set under "In the pill" in the colour popover; it opens the **colour popover** (288px, beside the pill; Palette, Pick color from canvas, Custom and Image colors), which replaced the Colour sheet on every device. The drawing runs behind the pill: Fit and pan ignore it, and the Selection bar steers clear of it; the Canvas hint, toasts and Frame steppers may be covered by it. With no Project open there is no pill, and the New Project / Import bar takes the Progress bar's place.
_Avoid_: Dock (retired), toolbar, rail, tab bar

**Menu**:
The modal sheet of app-wide settings and links (language, theme, Name on exports, Keyboard shortcuts, Overview, the source link), opened by the first button of the Canvas strip, an icon with the word "Menu" (ticket 431), which is there with or without a Project. Everything about the open Project lives in the Project sheet instead.
_Avoid_: More, header menu

**Project sheet**:
The modal sheet the Canvas strip's Project button opens (ticket 431): the open Project's name, size and save state, Bead and Replace bead, the Frame's Technique and Edit Frame, Save and Export, Beads needed, New Project, Import and Saved Projects, and last **Delete all** (the Project's whole drawing, behind its usual confirmation). Remove line and Name piece are on the Context bar only.
_Avoid_: Pattern sheet, Tool sheet (gone)

**Canvas strip**:
The slim row along the top of the canvas box, at every width (tickets 425, 431, ADR 0055). Left to right: Menu, Project (each an icon and its word; Project only with a Project open), the Rulers toggle (`R`), Undo, Redo, zoom out, the zoom level, zoom in, Fit, then the Canvas color picker. It names nothing: no title, size line, printed-size estimate, icon or keyboard hint. On a phone Menu, Project and Canvas color stay in place and the middle scrolls sideways with touch-sized buttons. While a picture is being framed (Convert image) it holds Menu and the framing step's own zoom. It replaced the draggable Zoom pill.
_Avoid_: Zoom pill, Canvas header

**Canvas hint**:
The one line of shortcuts ("scroll or space drag to move · ⌘ scroll to zoom · 5 Hand · R Rulers") at the top-centre of the drawing area, under the strip (the Tool pill may cover it when docked at the top). Shown only while the Project has no beads and at every size except a phone; it goes with the first bead (ticket 429, ADR 0055).
_Avoid_: tip, tutorial

**Message**:
A notice or toast. A toast (a short-lived result) shows at the top-right of the canvas box under the strip, stacking downward, on the toast layer: above sheets, below modals and Tooltips (ticket 429, ADR 0055). The Tool pill may cover a toast when docked at the right or top.
_Avoid_: snackbar, alert

**Tool button**:
A Tools-group tool shown as an icon-only tile in the Tool pill, the active one on the panel fill with an accent icon, with no text label: its name, its shortcut and, where the tool needs one, a one-line description appear in its Tooltip. Every tool has a digit key, 1 to 6 in the order Paint, Fill, Select, Eraser, Hand, Piece (7 is free again; tickets 292, 431), shown as a small badge in the tile's top-right corner where a keyboard is likely (ticket 438). The letters E, H and F no longer pick tools. The name stays as the button's accessible name.
_Avoid_: tab, tool tab

**Tooltip**:
The design system's hover, keyboard-focus and long-press (on touch) help for a control: a name (always), the shortcut as a key chip (optional) and a description line (optional). Any control may have one, icon-only or labelled: a control shows a Tooltip exactly when one is given to it, with no other condition. It replaces the browser's native title everywhere. A disabled control's Tooltip says why it is disabled. It is not an (i) button that has to be clicked; always-visible help text is a Note. A Tooltip is never clipped (ticket 265): its bubble opens in the browser's top layer, outside every column, sheet and canvas that holds its button, on the side of the button that has room (above near the bottom of the screen, below near the top), inside the screen on all four edges, and wraps at a maximum width (the wide-tooltip measure, 15rem) instead of running in one long strip.

**Note**:
A thin, always-visible gray block of helper text under a control or panel (for example the Estimated size or the Bead quantities explanation). It replaces every (i) button that had to be clicked to show its text.
_Avoid_: info tip, (i) popup, hint

## Key chip

A hotkey drawn as a small key beside a control: in a Tooltip, as the badge on a Tool pill tile, in the Canvas hint. Chips are shown only where a keyboard is likely (ticket 438): by default when the device has a fine pointer that can hover, or, on a touch-only device, once a real keyboard key (Tab, Escape, an arrow, or any key with Ctrl or Cmd) has been seen in the session. The switch at the top of Keyboard shortcuts overrides this on the device: its first flip stores on or off, and the UI has no way back to automatic. The chips inside Keyboard shortcuts itself are never hidden. Every chip is drawn by the shared `KeyChip`, so a new control inherits the behaviour.
