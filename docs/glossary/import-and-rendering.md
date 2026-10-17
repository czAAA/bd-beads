# Glossary: Import and rendering

Convert image, Image colors, the Project renderer and the Bead pointer. Part of the glossary split out of `CONTEXT.md` (ticket 380); the index is [README.md](README.md).

**Convert image**: Needs a size: the picture lands in a Frame of that size on a new Canvas (ADR 0026).
Creating a Project from a picture instead of an empty grid: the picture is shown rendered as beads, and a frame — the Schema itself, sized by its physical dimensions, Bead and Technique — is positioned over it to choose which part is kept. What falls inside the frame is resampled onto the Project's grid and its colors become the Project's Image colors. A way of creating a Project only, never a command that converts into one already open.
_Avoid_: import image, trace, pixelate, image import

**Image colors**:
The set of colors one Convert image produced, saved with that Project and offered alongside the Palette while it is open. Frozen at the moment of conversion: painting a new color never adds to it and erasing one never removes it, because it records what the conversion found rather than what the Project currently holds. A Project created any other way has none.
_Avoid_: extracted palette, pattern palette, image palette, pattern colors

**Project renderer**:
The one thing that draws a Project's cells — for the editor, the Convert image preview and the exports — so a bead looks the same wherever it appears. Draws whatever part of the Project is in view, at the current zoom and rotation, in the Technique's geometry. One renderer over two spaces: the canvas of the editor, where every position is real and the Frame sits where it is, and the Frame alone of the exports, the Convert image preview and the Overview, where the Frame's first bead is position (0, 0). The overlay layer is drawn in the same space.
_Avoid_: grid component, exporter, preview renderer

**Bead rim** (ticket 0460):
A faint line just inside every bead's edge (0.75px), so where one bead ends and the next starts shows even when both are the same color. Every theme has one: a dark tint in light and high contrast, a white tint in dark. The same on every bead and in every Technique, 0.75px in the Project's own px so it shrinks with zoom with the bead; exports and printed pages draw their own (light) rim, unchanged. It sits under every overlay (the Frame, the Selection, the Bead pointer, the Row progress marks).
_Avoid_: border, outline (the hover outline is another thing), grid line, gap

**Drawing surface**:
What the Project renderer draws on inside the canvas panel: a base layer holding the cells, and an overlay layer holding everything that comes and goes with the pointer — hover preview, the bead pointer, Selection, Mirror axes, paste preview and the Row progress marker. It is not the "canvas" of the App shell layout, which is the panel that holds it.
_Avoid_: canvas (that is the panel), bitmap, canvas element

**Bead pointer** (ticket 353):
What the pointer is over the beads of an open Project, for a mouse and a hovering pen alike: a small bead-shaped marker, 90% of a bead as drawn less 1px (so it follows zoom), centred on the pointer rather than snapped to the bead under it, rounded in peyote and square otherwise, and looking like the hover preview (the chosen color at 60%, else the 2px dark outline; the preview fills only its bead, in the bead's own shape, and on peyote leaves out the part the next row's beads lie over). The OS pointer is hidden there; a pen lifting away or leaving the board drops it, and a finger shows none. The other pointers stay: not-allowed over the Frame's margin, grab for the Hand tool and Space, and the Set Frame cursor.
_Avoid_: crosshair, cursor (that is the keyboard's bead cursor)
