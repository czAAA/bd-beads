# BeadPicker

The one way to choose a Bead: in the Layer settings section (LayerSettings card) wherever a layer is set, and in Convert image (ticket 535).

- **Collapsed** (the default): the Bead's name (`control`), one line below it in `meta` / `muted` saying what the Bead decides ("Sets size, weight and colors."), and a small `in-box` button "Change" with a chevron on the right. A person who does not care never opens it.
- **Opened** (the button now reads "Close", chevron up): three steps in a row that wraps on a phone, each a `label` (lowercase, `muted`) over an `in-box` menu button showing the current choice: **Brand**, **Form factor**, **Bead size**. Menus, not native selects (ticket 442); the chosen item has a check.
- Each step lists only what exists. Picking a Brand narrows the Form factors, picking a Form factor narrows the sizes. A step with one choice takes it. Nothing is picked until a whole Bead is known; until then the later step reads "Choose".
- **Replace Bead** (Project panel): the Bead's name stays in the "bead" row above, the picker is compact (hint and button only) and closes after a pick, which asks the confirmation. When the Project's own copy differs from the catalog's Bead, the size menu lists it first, disabled, with "(as saved)", and the catalog's Bead beside it.
- New Project, Starter setup and Convert image offer only the catalog's current Beads.

**In the Project panel (ticket 0554):** no collapsed summary and no Change button: the Bead row holds the three steps as PanelPicker buttons on one line, Brand, Type (the Form factor) and Size (`[Miyuki ⌄] [Delica ⌄] [11/0 ⌄]`), each opening its own menu; a pick asks the Replace Bead confirmation. A Brand or Type pick that leaves the size without a match picks the nearest size and says so in the confirmation. Since ticket 0671 every place uses this form; the collapsed one above is retired with the Starter setup's old Bead field.

Hand-written from ticket 535; the Vue component `BeadSection.vue` is the real thing.
