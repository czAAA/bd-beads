# Glossary: Homepage

The Homepage. Part of the glossary split out of `CONTEXT.md` (ticket 380); the index is [README.md](README.md).

**Homepage**:
The page outside the editor, at its own address, that introduces openbeads feature by feature to someone new to it. There are no accounts, so "new" means only that this device's Project library is empty. It is laid out as one canvas box like the editor (ADR 0073) in the middle of a page of its own ground: the Canvas strip on top, the hero under it, one section at a time over the canvas background (the editor's empty positions of a Miyuki Delica 11/0 Project worked in peyote, each at the Bead's real proportions, sized by the Homepage zoom), and the Progress bar below with the sections in place of rows. Scrolling the page turns the box from one section to the next (What's inside, the coffee tile, Three ways to use it); the box itself never moves (ticket 0739). While the library is not empty, **Projects library · N** (the Menu row's name, N the Project count, read without decoding any Project) stands beside Open the editor and opens the editor at its own address, `?open=saved-projects`, with no Project open and the Menu on Saved Projects, so a bookmark does the same; the Homepage's Menu has the same Saved Projects row and list, Remove and Export working there, and a pick opens the editor on that Project by `?project=<id>` (ticket 0716).
_Avoid_: landing page, home page, about page, marketing page

**Homepage zoom**:
The Canvas strip's zoom on the Homepage: it scales the page's content (75–200%, remembered on this device; Fit returns to 100%), reflowing text and never scrolling sideways.
