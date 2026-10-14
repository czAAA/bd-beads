# Toolbox

> **Retired (ticket 412).** The Toolbox layout is gone: the app has one layout, the Dock layout (ADR 0046). These controls live in the Dock's Tool, Colour and Frame sheets (ToolSheet, ToolTabs and Dock cards), the ContextBar and the ZoomPill. Kept as the record of the v18 rail.

The first box of the left column: Tool groups Tools, Colors and Edit, then the Frame disclosure row.

- Box: `panel` fill, 1px `panel-line`, radius-lg, padding 24, no shadow, 312px wide. Groups sit 20px apart.
- A **Tool group** is a `label` (DM Mono, lowercase, `muted`, 8px above) followed by its controls. It has no box of its own. Controls use the in-box button variants.
- **Edit group:** four equal 38px icon buttons, gap 6: Undo, Redo, Rotate, Copy (icons 17). Rotate turns the Selection, so without one it is disabled (`faint`). Save and Export are not here; they live in the SaveBox.
- **Tools group (v18):** six swatch-sized tiles (icon centered, hotkey in the top-right corner), then Remove Frame, Remove line and Clear (ToolTabs card).
- **Frame row:** the only disclosure row in the app's Toolbox: the `frame` icon, "Frame", the Frame number chip and the measured size ("1.4 × 1.1 cm"), then a chevron. The Mirror row no longer sits here; the Mirror controls are not in this box.
- A new group is either an always-open group or a DisclosureRow; pick one.
- With no Pattern open, or during Convert image framing, the New Pattern form takes this box's place, styled like it (Derived).

Hand-written from DESIGN.md §4.2 and §5.7 and the v16 sign-off; static rendition.
