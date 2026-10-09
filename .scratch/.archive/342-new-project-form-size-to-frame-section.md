# 342: Take the size out of the New Project form; add the unit to the Frame section

**What to build:** Remove the Frame, Unit and Width & Height sections from the New Project form. The size is set afterwards in the Toolbox's Frame section, which already has it. In the Frame section:
- **Unit switch:** beads | mm, remembered on the device, not in the Project.
- **Labels:** Width and Height instead of columns and rows, everywhere a Pattern size is shown. Row stays only in Row progress, Row direction and Remove row/column.
- **Steppers:** in mm, each press adds or removes one bead and the field shows the result in mm. A typed mm value always rounds **up** to the next whole bead.
- **Estimated size:** shows the other unit: mm when the unit is beads, and the bead count when the unit is mm.

Convert image still asks for a size (ADR 0026), so keep a size step in its own dialog. Remove the form's Estimate info popup (see ticket 328). Update the NewPatternForm, Frame and NumbersAndUnits cards. CONTEXT.md's Pattern size entry is already updated.

**Spec:** 343 (unified controls spec)

**Blocked by:** None (can start immediately).

**Status:** done

- [x] The New Project form has no Frame, Unit or Width & Height sections
- [x] The Frame section has the beads | mm switch, remembered on the device
- [x] A typed mm value rounds up to whole beads; steppers move one bead at a time
- [x] Estimated size shows the other unit
- [x] Width and Height are the labels everywhere a Pattern size is shown
- [x] The design-system cards and changelog are updated

**Notes:** the Frame section's unit switch is beads | mm; the stepper field shows the Frame's width or height in mm and a press adds or removes one bead. A typed mm value rounds up in the shared conversion (`computeGridDimensions`), which Convert image's new size dialog (`ConvertImageSizeDialog`) uses. The dialog replaces the form's Frame, Unit and Width & Height sections and its Estimate info popup; the unit conversion row (ticket 179) went with them. The canvas strip, the Frame announcement and the Frame section say Width and Height; the Project's accessible label still reads "N by M beads".
