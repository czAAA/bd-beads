# NewProjectForm

The form that makes a new Project, in the left column while no Project is open.

- Takes the Toolbox's place in the left column while no Project is open (and on the phone, a full-height modal sheet from the Project panel's New Project).
- Order: Name (optional, a placeholder name is used), Maker's name (optional), Bead, Technique, Create Project. Bead and Technique are preset and can be changed at any time.
- **No size (ticket 342).** The form has no Frame, Unit or Width & Height sections and no Estimate info popup: Create Project always opens a Canvas with no Frame, and the size is set afterwards in the Toolbox's Frame section (MirrorSizeControls card), in beads or mm.
- "or" then Convert image, always enabled. A chosen picture opens a small size dialog before framing (ADR 0026): "How big is the Schema?", the beads | mm switch, Width and Height (a typed mm value rounds up to whole beads), the size in the other unit beside the switch, the slow-framing heads-up, Cancel and "Frame the picture".
- Convert image warnings (slow framing) use the warning icon; its errors (HEIC, SVG, too big, too many pixels, unreadable, wrong format) use the error style, with the app's existing sentences.

Hand-written from the Phase A sign-off (forms, screens and states) and the v16 sign-off; static rendition.
