# Glossary: Tool pill and controls

The Tool pill and the controls and surfaces around it. Part of the glossary split out of `CONTEXT.md` (ticket 380); the index is [README.md](README.md). The Toolbox, the rail of controls that sat in the left column, is gone (ticket 412): its controls live in the Tool pill, the Context bar, the Project and Menu panels and the Canvas strip (the Zoom pill is gone, ticket 425).

**Tool group**:
A titled set of related controls — Tools (Paint, Fill, Select, Piece, Eraser, Hand; Select all is not a Tool: it is the Selection bar's first item and Ctrl/⌘+A, tickets 414, 428, 439), Colors, Edit, Row progress. The Tool pill, the sheets and the keyboard shortcuts help gather the same controls under the same names.
_Avoid_: subbox, card, section, panel

**Tool pill layout** (formerly **Dock layout**):
The main layout at every width (ADR 0046, ADR 0059): the canvas box is the screen, flush with every screen edge (the safe-area inset where larger), with the Canvas strip on top, the drawing area and the Canvas footer below it, and the Tool pill floating over the drawing area; sheets for the controls; no header, no left column. Menu and Project open from the Canvas strip (ticket 431). It is the only layout (ticket 412 removed the Toolbox layout and its flag; ticket 439 removed the Dock).
_Avoid_: phone layout, mobile layout, touch layout, Dock layout

**Tool pill** (replaces the retired **Dock**):
The tools as a pill floating over the drawing area (ticket 439, ADR 0059; ToolPill card), 6px in from the edge it is docked to and centred along it, outside the canvas's zoom so it never zooms. Order, from its leading end: the grip ("Move tools"), six tool tiles (Paint, Fill, Select, Piece, Eraser, Hand), a divider, the colour control and, where the device needs it, a second divider and the Pen/Mouse toggle. A tile picks its tool at once; there is no Tool sheet. Icon-only, 48px across, 40px tiles, a `toolbar` named "Tools". It docks to the left, top, right or bottom (default bottom, vertical on the sides): dragged (after 8px, with four drop zones, the nearest edge snaps), moved with the grip's arrow keys, or set in the Menu panel's "Tools position"; the choice is kept on the device. Longer than its edge (a phone), it scrolls along its length. The colour control is the swatch tile (with a palette icon inside it), then three recents (shown only while the pill fits its edge; eight recents are kept on the device, a pick moves to the front); it opens the **colour popover** (288px, beside the pill; Palette, Pick color from canvas, and Custom), which replaced the Colour sheet on every device. The drawing runs behind the pill: Fit and pan ignore it, and the Selection bar steers clear of it; the Canvas hint, toasts and Frame steppers may be covered by it. With no Project open there is no pill, and the New Project / Import bar takes the Progress bar's place.
_Avoid_: Dock (retired), toolbar, rail, tab bar

**Panel**:
A dropdown that hangs from a Canvas strip button, built on one parent component, `AppPanel`: **Menu panel** (`MenuPanel`), **Project panel** (`ProjectPanel`) and **Frame panel** (`FramePanel`). The word is "panel" everywhere (code, specs, tickets); the button keeps its label ("Menu", "Project", "Frame"). A panel can stack **Subpanels** over its root.
_Avoid_: sheet (for these three), dropdown, Frame bar (retired name), PanelShell (retired name)

**Menu**:
The Menu panel: the modal dropdown of app-wide settings and links (language, theme, Name on exports, Keyboard shortcuts, Overview, the source link), opened by the first button of the Canvas strip, an icon with the word "Menu" (ticket 431), which is there with or without a Project. Everything about the open Project lives in the Project panel instead.
_Avoid_: More, header menu

**Subpanel** (was Panel sub-view):
A level inside a panel (Menu panel, Project panel, Frame panel), stacked over its root (ticket 493): the header shows a Back arrow and the subpanel's title, the body swaps to the subpanel and Back returns one level, to the panel's root list from the first. Built into `AppPanel`, so every panel inherits it. The first user is **New Project** (the Menu's accent-coloured row): the New Project form is a subpanel, not a sheet. Opening it leaves the open Project untouched until Create; Back and closing the panel discard the form's draft; Create and Convert image close the panel. The Menu opens straight on it while the library has no saved Project and from the empty-canvas bar's New Project button; otherwise it opens at the root. Escape pops a level, except on the first level when it was the starting view, where it closes the panel.
_Avoid_: New Project panel, New Project modal (gone)

**New Project**:
The Menu's accent-coloured row and the Subpanel it opens (spec 0478). Its first block is the Template gallery: a **Blank canvas** tile, checked, and one card per **Template**; below it the form that makes a Canvas (Name, Maker's name, Bead, Technique, Create Project) and Convert image. A tap on a Template card pushes its **Template setup** one level deeper; Blank canvas, Convert image and Import work as before.
_Avoid_: New Pattern, new project sheet

**Template**:
A named starting point for a Frame (ticket 493, spec 0488): Gerdan, Bracelet, Earrings, Bag or Custom scheme. One entry in a typed registry (`domain/templates.ts`): an id that is also the key of its copy, the Technique it is woven in by default, the Techniques it allows, and per side (width, height) a default, a minimum, a maximum, optional presets and an optional lock (Earrings keep their width). Sizes are in beads, Units in Right-angle weave and Netting, and are starting values. Bead crochet and Constructor are not Templates. Nothing in a Project records the Template it was made from. A Template also puts a Frame on an open Project (ticket 495): the Project panel's Frame area offers **Add Frame from Template**, or **Replace Frame** when there is one, through the same gallery (without Blank canvas) and setup. The Frame is empty, in the Template's Technique, centred on the visible Canvas and snapped; the Canvas under it is hidden, not changed. Replacing drops the old Frame's beads and passes (asking first when it holds beads), as one Undo step, and is held still once a pass is done. The gallery card shows its name, description, spec line ("24 × 80 · Loom") and a picture: a small symmetric ornament, generated from the Template and drawn by the Project renderer in its Technique (`domain/templateSample.ts`). It is only an example; Create still gives an empty Frame.
_Avoid_: preset, product, shape, pattern (for the starting point)

**Template setup**:
The subpanel a tap on a Template card opens: Name (the Template's name as its placeholder), Bead, Technique (only the allowed ones, no choice when there is one), Brick block for brick stitch, the unit (beads or Units, mm, cm), Width and Height as steppers with the Template's usual sizes as chips, a live Estimated size, and Create Project in the pinned footer. It shows the same sample picture, following the chosen Technique, beside a note that the Frame starts empty. It states no Maker's name. On an open Project it has no Name or Bead (the Project's Bead measures the size) and its footer button is Add Frame or Replace Frame. Create makes a Project whose Frame is in place at the origin and empty, Row progress on, the Canvas in the Frame's Technique, named by what was typed or the Template's name.
_Avoid_: Template form, Template dialog

**Project panel**:
The Project panel: the modal dropdown the Canvas strip's Project button opens (ticket 431): the open Project's name, size and save state, Bead and Replace bead, the Frame's Technique, Export, Beads needed, New Project, Import and Saved Projects, and last **Delete all** (the Project's whole drawing, behind its usual confirmation). Remove line and Name piece are on the Context bar only.
_Avoid_: Project sheet, Pattern sheet, Tool sheet (gone)

**Canvas strip**:
The slim row along the top of the canvas box, on the editor and on the Overview, at every width (tickets 425, 431, ADR 0055, ADR 0073). One component in both places, in three parts. Left: the panels, Menu (an icon and its word) then, in the editor, Project and Frame. Centre: the **Wordmark**, centred on the strip itself. Right: the tools, Rotate canvas (spec 0470), the Rulers toggle (`R`), Undo and Redo, then zoom out, zoom in and Fit, right-aligned (ticket 543). There is no zoom level in percent. Apart from the Wordmark it names nothing: no title, size line, printed-size estimate or keyboard hint. Under 1024px the words of Menu and Project and the Wordmark's lettering go and only icons stay. On a phone the editor keeps its present strip, the middle scrolling sideways with touch-sized buttons, and no Wordmark; the Overview's phone strip keeps the Wordmark's logo. While a picture is being framed (Convert image) it holds Menu, the Wordmark and the framing step's own zoom. On the Overview the zoom scales the page's content (**Overview zoom**). It replaced the draggable Zoom pill.
_Height (ticket 0544):_ as tall as its tallest item plus 1px above and below (the Menu button + 2px with a mouse, 46px on touch), one derived rule (`--strip-height`) shared with the Overview. Its top corners follow the canvas box's rounded corners; its left, right and bottom edges are drawn.
_Avoid_: Zoom pill, Canvas header

**Wordmark**:
The logo and the "openbeads" wordmark (in the display serif) as one unit, centred in the Canvas strip on every page. In the editor it opens the Overview; on the Overview it is the current page, so it is not a link. The wordmark hides first when the strip narrows, then the logo.
_Avoid_: header logo, title, app name

**Canvas footer**:
The slot along the bottom edge of the canvas box, the same height at every width (ADR 0073). In the editor it holds the Progress bar while a Project is open; on the Overview it is there and empty, so the box looks the same on both pages and nothing jumps.
_Height (ticket 0544):_ as tall as its tallest item plus 1px above and below (a large Row done button + 2px, the phone's two rows + 2px), one derived rule (`--progress-height`) so the Overview's empty footer matches the editor's. Its bottom corners follow the canvas box's rounded corners; its left, right and top edges are drawn.
_Avoid_: footer bar, bottom bar

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

**Tab stop**:
A place Tab reaches (ADR 0075). The Canvas strip has three, one per section (the panels Menu, Project and Frame; the Wordmark; the right-hand tools), and ←/→ step inside a section without wrapping or crossing into the next. The Tool pill is one stop, stepped by the arrows along its own axis (↑/↓ when it stands left or right, ←/→ when top or bottom; the other axis does nothing; Home and End jump, the ends stop). The Tool pill's colour control and recents are inside its stop. After the strip and the Tool pill come the Progress bar (with a Frame, its Fit frame button before one), the Frame's own controls and the Selection bar (only with a Selection); Shift+Tab walks the same list backwards. Enter or ↓ on Menu, Project or Frame opens it with focus on its first item; Enter or Space picks a tool. In an open Menu, Tab and Shift+Tab step through the items and wrap, so focus never leaves the panel; ←/→ closes or opens a row's dropdown (language, theme), Enter or ↓ opens it, Escape closes the panel. The **focus ring** is neutral (`ink`: black in light, white in dark), 2px at 1px offset, following the control's radius, 3px black in high contrast; yellow and orange mean selected, never focused.
_Avoid_: tab order (the whole list), focus colour

## Key chip

A hotkey drawn as a small key beside a control: in a Tooltip, as the badge on a Tool pill tile, in the Canvas hint. Chips are shown only where a keyboard is likely (ticket 438): by default when the device has a fine pointer that can hover, or, on a touch-only device, once a real keyboard key (Tab, Escape, an arrow, or any key with Ctrl or Cmd) has been seen in the session. The switch at the top of Keyboard shortcuts overrides this on the device: its first flip stores on or off, and the UI has no way back to automatic. The chips inside Keyboard shortcuts itself are never hidden. Every chip is drawn by the shared `KeyChip`, so a new control inherits the behaviour.

**Outside press**:
A press (mouse, touch or pen) that lands outside the top-most open overlay (a sheet, panel, popover, dropdown, the colour popover with its Custom color picker, or a dialog). It only closes that overlay: it never draws, selects or presses what is under it, and the click that follows is swallowed. A second press closes the overlay beneath. The overlay's own opener, and a dialog raised from it are not outside; a confirmation that demands an answer swallows the press and stays. One registry, `useOverlayLayer`, applies this to every overlay. See ADR 0061.
