# Toolbox

The first box of the left column: Tool groups Tools, Colors and Edit, then the Mirror and Frame disclosure rows.

- Box: `panel` fill, 1px `panel-line`, radius-lg, padding 24, no shadow, 312px wide. Groups sit 20px apart.
- A **Tool group** is a `label` (DM Mono, lowercase, `muted`, 8px above) followed by its controls. It has no box of its own. Controls use the in-box button variants.
- **Tools group, Frame tool (ticket 258):** a sixth tab, the `frame` icon and "Set Frame" ("Задать рамку"; `F`), active while the Frame is being set. With a Frame set, a "Remove Frame" ("Убрать рамку") link with the `close` icon sits in the links row beside Remove line and Delete all; it is absent with no Frame and disabled while Row progress is on. Removing leaves every bead alone, keeps Set Frame on for the next Frame, and is one Undo step.
- **Edit group:** four equal 38px icon buttons, gap 6: Undo, Redo, Rotate, Copy (icons 17). Rotate turns the Frame, so without a Frame it is disabled (`faint`) and named "Rotate, Set Frame first". Save and Export are not here; they live in the SaveBox.
- A new group is either an always-open group or a DisclosureRow; pick one.
- With no Pattern open, or during Convert image framing, the New Pattern form takes this box's place, styled like it (Derived).

Hand-written from DESIGN.md §4.2 and §5.7 and the v16 sign-off; static rendition.
