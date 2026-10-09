# MirrorSizeControls

The Mirror and Frame disclosure rows opened in place, and the Estimated size warning. (The card keeps its v15 name.)

- A DisclosureRow opens in place, pushing what follows down; the chevron turns up. Each control is one line: Steppers for the axes, a Switch for Copy mode, two buttons for Mirror current.
- **Frame (v16, in Size's place):** a **beads | mm** switch (ticket 342; a small segmented control, kept on the device, never in the Pattern), then Width and Height Steppers, then Fit to drawing and Remove Frame side by side. The Steppers move one bead per press in either unit; in mm the field shows the Frame's width or height in mm, and a size typed in mm (Convert image's size dialog) always rounds up to the next whole bead. The Estimated size is the row's own value, in the other unit: mm when the unit is beads, the bead count ("≈ 40×30 beads") when it is mm. Change from (end / start) is gone: the Frame's handles on the canvas move any edge. With no Frame the row reads "not set" and opening it starts Set Frame.
- While Row progress is on, the Frame's steppers and handles are locked and "Turn off Row progress to change the size" is written under them.
- The estimate warning is the Tooltip at a 280px measure; on touch it opens on tap.

Hand-written from the Phase A sign-off (forms, screens and states) and the v16 sign-off; static rendition.
