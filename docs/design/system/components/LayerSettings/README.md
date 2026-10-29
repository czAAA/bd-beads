# LayerSettings

The one section that sets a layer (ADR 0079, ticket 0670): the Canvas or a Frame, each a sub-canvas with everything a canvas has. Given a layer it sets its Technique and that Technique's settings, a Custom frame's shape settings, its Bead and Bead shape, and its Background. The same section wherever a layer is set, so a new layer property is added here once and shows up everywhere:

- **New Project form** (NewPatternForm card): both layers of the new Project start from it. Nothing is asked; each pick is kept in the form.
- **Project panel, canvas section** (ProjectPanel card): the Canvas's. It changes any time, with a Frame and once Row progress has started, as Row progress belongs to the Frame.
- **Frame panel, settings section** (Frame card): the Frame's.
- **Starter setup** (StarterGallery card, ticket 0671): the Starter's Frame, pre-filled from the Starter. Nothing is asked; each pick is kept in the setup. Its shape's sizes are the setup's own rows, so no shape settings show here.

## Layout (top to bottom, in the panel's density, MenuPanel card)

1. **Technique:** a PanelPicker (the `pattern` icon) offering every Technique, or on a Custom frame only those its Frame shape supports. Then one row per setting the Technique describes, a SettingStepper (Drop for peyote and for brick stitch, each Technique's its own, ticket 0691), its label above a small Stepper, lined up with the picker (10px in).
2. **Shape settings** (a Custom frame only): one `panel-row` per setting, its name (`control`) at the left and a Stepper at the right (Rounds, Part size or Rows; a Fringe earring's Top width, Top rows and Fringe length), then the Fringe style as a SegmentedControl of the setup's names under its label. Shrinking keeps what is given up as Folded beads, without asking; the steppers commit once, as one Undo step, when the panel closes.
3. **Bead:** the heading "Bead" (`label` style, `muted`), then the Bead shape row (Symmetric | Real, a small SegmentedControl, BeadShape Tooltips) and the three PanelPicker buttons Brand, Type and Size on one row (BeadPicker card). A pick only asks: the Project panel and the Frame panel open Replace bead? for that layer (ConfirmDialogs card), and the pickers keep showing the layer's Bead until it is confirmed.
4. **Background:** the heading "Background" (`label` style, `muted`), then the BackgroundColorPicker (CanvasBackground card): the five colors of the theme and the Custom color tile, the chosen one's name and hex; in high contrast the one `body` line "The canvas stays white in high contrast.". Its radio group is named "Canvas color" for the Canvas and "Frame background" for a Frame.

The groups are 8px apart. The Bead and Background groups are named groups for screen readers, named by their headings.

## Undo and Row progress

- **What is woven is undone:** a Technique, its settings, a Bead and a shape's settings are each one Undo step.
- **How it looks is not:** a Bead shape and a Background are views, saved with the Project and never Undo steps; Undo and Redo leave them as they are.
- **On a Frame, only what moves positions waits** while a Row progress pass is done: the Technique picker, its steppers and the shape settings are off (`faint`), each with its reason in its Tooltip ("Rows are marked done. Remove the Frame to change the Technique.") and under the shape settings the `meta-small` line "Rows are marked done. Remove the frame to change the size.". The Bead, the Bead shape and the Background never wait. The Canvas's never waits.

## Folded summary

Where the section is a PanelSection, its folded summary is the layer's Technique and Bead: "Loom · Miyuki Delica 11/0".

## Copy

English: Technique, Drop, Bead, Bead shape, Symmetric, Real, Brand, Type, Size, Background, Canvas color, Frame background, Settings (the Frame panel's section). Every language: `writing.md` (Layer settings copy, ticket 0670).

Hand-written for ticket 0670; static rendition.
