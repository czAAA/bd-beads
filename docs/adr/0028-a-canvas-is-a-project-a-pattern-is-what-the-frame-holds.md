# A canvas is a Project; a Pattern is what the Frame holds

**Status: accepted.** Ticket 262.

After the open canvas ([ADR 0026](0026-open-canvas-and-frame.md)) "Pattern" named two things: the whole saved canvas and the beads inside the Frame. Strings such as "Save Pattern" and "Pattern · 21 columns" sat side by side meaning different things.

- A **Project** is what a person creates, opens, saves, lists, exports as a file and shares: the Open canvas with every Piece, the Frame, Technique, Bead, Row progress, Image colors and maker's name.
- A **Pattern** is only the beads inside a Project's Frame. A Project with no Frame has no Pattern yet. Convert image still turns a picture into a Pattern, as the Frame's content of a new Project.
- Copy follows it in every language (Russian: "проект" for Project, "схема" for Pattern). "Clear pattern" is **Clear**: it empties the whole canvas and turns Row progress off.
- The code follows: the saved thing is `Project*` throughout (types, files, composables, components, test ids, i18n keys). There is no `Pattern` type; code that needs the Frame's contents reads `beadsInFrame`. The renderer is the **Project renderer**.

**Wire formats keep the old word.** The localStorage key `bd-beads:patterns`, the file kinds `bd-beads/pattern` and `bd-beads/library`, and the `patterns` JSON key live on people's devices and in their files. Renaming them gains nothing a person sees and risks stranding saved work, so they stay, the one deliberate exception to "no code says Pattern for a Project"; the stored-data compatibility test pins them. The design system's own asset names (`pattern.svg`, the `TourPattern` card) are left to it.

**Considered options**: renaming only the UI (rejected: two words for one thing in every file a developer opens); teaching "Pattern means both" (rejected: ambiguous in exactly the strings that matter, Export and Beads needed).
