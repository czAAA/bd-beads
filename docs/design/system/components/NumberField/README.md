# NumberField

A number input with its unit as a label on the border, and the Select that shares its look.

- NumberField: the unit is a label on the top border, 12px from the right edge, in `meta-small` `muted`, on a `elevated` patch 4px either side so the border is cut behind it. Its text is the chosen Unit ("beads", "mm" or "cm") and changes with it. It is not inside the field, so the value and the Stepper buttons keep the full width. The label takes the border's color: `ink` on focus, `danger` when invalid, `faint` when disabled. It is announced with the field, once. Numeric keyboard on touch; numeric keyboard on touch (`inputmode="decimal"` for mm and cm, `numeric` for beads).
- Select: the native select (the phone and iPad show their own picker), styled like the field with a 16px `chevron-down` in `muted`.
- The bead list reads "Brand Name size", as the catalog does.

Hand-written from the Phase A sign-off (forms, screens and states); static rendition.
