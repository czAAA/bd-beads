# A canvas is a Project; a Pattern is what the Frame holds

**Status: accepted.** Ticket 262. Follows [ADR 0026](0026-open-canvas-and-frame.md), which made what people open, save and share an endless canvas of Pieces with a Frame marking which beads are the Pattern.

## Context

After ADR 0026 "Pattern" named two things: the whole saved canvas (the library, files, the New Pattern form, the code) and the beads inside the Frame (exports, Beads needed, Row progress, Rotate). Strings such as "Save Pattern" and "Pattern · 21 columns" sat side by side meaning different things.

## Decision

- A **Project** is the thing a person creates, opens, saves, lists, exports as a file and shares: the Open canvas with every Piece, the Frame, Technique, Bead, rotation, Row progress, Image colors and maker's name.
- A **Pattern** is only the beads inside a Project's Frame. A Project with no Frame has no Pattern yet.
- English and Russian copy follow it: "проект" for Project, "схема" stays for Pattern. Convert image still turns a picture into a Pattern (it becomes the Frame's content of a new Project).
- "Clear pattern" becomes **Clear** (it empties the whole canvas and turns Row progress off). Replace Bead's confirmation says "this Project will be about…" beside the Pattern size.
- The code follows: the saved thing is `Project*` throughout (types, files, composables, components, test ids, i18n keys). There is no `Pattern` type: code that needs the Frame's contents reads `beadsInFrame` and the Frame. The renderer is the **Project renderer**, since it draws Pieces and the Frame, not only the Pattern.

## Wire formats stay as they are

The localStorage key `bd-beads:patterns`, the file kinds `bd-beads/pattern`, `bd-beads/library` and `bd-beads/qr-pattern`, the `patterns` (file and storage) and `pattern` (QR) JSON keys, and the share link's `#pattern=` hash live on people's devices, in their files, in printed QR codes and in links already sent. Renaming them gains nothing a person sees and risks stranding saved work, so they are unchanged and nothing new is added. This is a deliberate exception to "no code refers to the old word"; the stored-data compatibility test pins them. The design system's own asset names (`pattern.svg`, the `TourPattern` card) are likewise left to the design system.

## Options considered

1. **Rename only the UI.** Cheap, but leaves two words for one thing in every file a developer opens.
2. **Rename UI and code (chosen), wire formats excepted.** One pass per layer; the compatibility test guards the exceptions.
3. **Do nothing and teach "Pattern means both".** Rejected: it makes "Pattern" ambiguous in exactly the strings that matter (Export, Beads needed).

## Consequences

- Earlier ADRs are history and keep their words; the ones whose titles say "pattern" (0007, 0012, 0016, 0018, 0019) carry a one-line note pointing here. Archived tickets are not touched.
- The design system still says "New Pattern" and "Saved Patterns"; its cards are updated in the repo (DESIGN.md §6, ADR 0030). Where its copy differs, it wins.
