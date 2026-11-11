# ImportResult

The result or error of Open Project file (ticket 0859: in is "Open Project file" everywhere).

- Results and errors show under the control that caused them, on a line of their own that wraps, as DESIGN.md says: no shadow, no close; they go when the next action happens.
- In the Menu panel the line shows under the Open Project file row, its text from the rows' label column, and the panel stays open after an import (ticket 523); there is no import toast. Under the empty Canvas's buttons it takes a row of its own.
- **Result:** "Projects added: {count}".
- **Errors** (`danger`, the `warning` icon), each saying what the file is and what to do (ticket 0859):
  - a picture (its type is `image/…` or its name ends in a picture's ending): "This is a picture. Use Convert image to turn it into beads."
  - a file named `….openbeads` that doesn't read: "This Project file is damaged and can't be opened."
  - anything else: "This isn't a Project file. Choose a file ending in .openbeads."
  The other languages are in `writing.md` (Project file copy).

Hand-written from the Phase A sign-off (forms, screens and states); static rendition.
