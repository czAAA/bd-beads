# Glossary: Homepage

The Homepage. Part of the glossary split out of `CONTEXT.md` (ticket 380); the index is [README.md](README.md).

**Homepage**:
The page outside the editor, at its own address, that introduces openbeads feature by feature to someone new to it. There are no accounts, so "new" means only that this device's Project library is empty. It is laid out as a canvas box like the editor (ADR 0073): the Canvas strip pinned on top, the Canvas footer (empty) pinned below, the page's content scrolling between them over the canvas background (the editor's empty positions of a Miyuki Delica 11/0 Project in the Symmetric bead shape worked in peyote, sized by the Homepage zoom), with bead drawings spread across the whole page behind the text. While the library is not empty, **Projects library · N** (the Menu row's name, N the Project count, read without decoding any Project) stands beside Open the editor and opens the editor at its own address, `?open=saved-projects`, with no Project open and the Menu on Saved Projects, so a bookmark does the same; the Homepage's Menu has the same Saved Projects row and list, Remove and Export working there, and a pick opens the editor on that Project by `?project=<id>` (ticket 0716).
_Avoid_: landing page, home page, about page, marketing page

**Homepage zoom**:
The Canvas strip's zoom on the Homepage: it scales the page's content (75–200%, remembered on this device; Fit returns to 100%), reflowing text and never scrolling sideways.
