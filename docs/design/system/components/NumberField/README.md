# NumberField

A number input and the Select that shares its look.

- NumberField: the unit ("beads", "mm" or "cm") is the field's placeholder, in `faint`, and follows the chosen Unit; it goes when a value is typed, and the Unit control beside the form still names it. It is not a label on the border (ticket 224 built that and commit 48ae79e reverted it, in favour of the placeholder). The placeholder is not a label: the field keeps its own visible label and name. Numeric keyboard on touch (`inputmode="decimal"` for mm and cm, `numeric` for beads).
- Select: the native select (the phone and iPad show their own picker), styled like the field with a 16px `chevron-down` in `muted`.
- The bead list reads "Brand Name size", as the catalog does.

Hand-written from the Phase A sign-off (forms, screens and states); static rendition.
