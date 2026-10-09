# 342: Take the size out of the New Project form; add the unit to the Frame section

**What to build:** Remove the Frame, Unit and Width & Height sections from the New Project form. The size is set afterwards in the Toolbox's Frame section, which already has it. In the Frame section:
- **Unit switch:** beads | mm, remembered on the device, not in the Project.
- **Labels:** Width and Height instead of columns and rows, everywhere a Pattern size is shown. Row stays only in Row progress, Row direction and Remove row/column.
- **Steppers:** in mm, each press adds or removes one bead and the field shows the result in mm. A typed mm value always rounds **up** to the next whole bead.
- **Estimated size:** shows the other unit: mm when the unit is beads, and the bead count when the unit is mm.

Convert image still asks for a size (ADR 0026), so keep a size step in its own dialog. Remove the form's Estimate info popup (see ticket 328). Update the NewPatternForm, Frame and NumbersAndUnits cards. CONTEXT.md's Pattern size entry is already updated.

**Spec:** 343 (unified controls spec)

**Blocked by:** None (can start immediately).

**Status:** ready-for-agent

- [ ] The New Project form has no Frame, Unit or Width & Height sections
- [ ] The Frame section has the beads | mm switch, remembered on the device
- [ ] A typed mm value rounds up to whole beads; steppers move one bead at a time
- [ ] Estimated size shows the other unit
- [ ] Width and Height are the labels everywhere a Pattern size is shown
- [ ] The design-system cards and changelog are updated
