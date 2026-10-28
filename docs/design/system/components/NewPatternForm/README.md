# NewProjectForm

The form that makes a new Project, in the left column while no Project is open.

- Takes the Toolbox's place in the left column while no Project is open (and on the phone, a full-height modal sheet from the Project panel's New Project).
- Order (ticket 0568): the title **Open canvas** with the subtitle "Draw on open canvas, set frame to export picture or pdf when needed", Name (optional, a placeholder name is used), Maker's name (optional), Bead, Technique, then three accent buttons separated by "or": Create Project, Convert image and Pick a starter (StarterGallery card). Name and Maker's name, Bead and Technique are the sections the Project panel shares (ProjectPanel card); here they apply at once, with no confirmation. Bead and Technique are preset and can be changed at any time.
- **No size (ticket 342).** The form has no Frame, Unit or Width & Height sections and no Estimate info popup: Create Project always opens a Canvas with no Frame, and the size is set afterwards in the Toolbox's Frame section (MirrorSizeControls card), in beads or mm.
- "or" then Convert image, always enabled. It opens the Convert image wizard (ConvertImage card, spec 0645, ticket 0646), which starts from this form's Name, Maker's name, Bead and Technique and keeps its own copy, so Cancel there leaves the form untouched. Until spec 0645 is built, a chosen picture opens a small size dialog before framing (ADR 0026): "How big is the Schema?", the beads | mm switch, Width and Height (a typed mm value rounds up to whole beads), the size in the other unit beside the switch, the slow-framing heads-up, Cancel and "Frame the picture".
- Convert image warnings (slow framing) use the warning icon; its errors (HEIC, SVG, too big, too many pixels, unreadable, wrong format) use the error style, with the app's existing sentences.

Hand-written from the Phase A sign-off (forms, screens and states) and the v16 sign-off; static rendition.
