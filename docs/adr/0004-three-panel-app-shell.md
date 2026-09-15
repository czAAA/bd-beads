# App shell is a three-panel tool layout, scoped to bd-beads' own features

The app shell is organized as top bar + left tool sidebar + center canvas + right context panel (see ticket 14), following the structural convention of typical drawing-app tool layouts. New UI is placed into one of these four regions by function — drawing tools and canvas-level settings go in the left sidebar, Pattern-level and cross-cutting views (switching patterns, catalog/quantity, row progress, import/export) go in the right context panel — rather than each ticket inventing its own screen or nav pattern.

This layout only hosts features bd-beads actually has or has planned. Conventions common in general-purpose drawing/design tools (login/accounts, a gallery, animation, an image library/objects panel, a generic layers panel, object clone/flip/shadow controls) are deliberately not adopted, since bd-beads is a single-user, local-only tool for a fixed domain (beadwork patterns), not a general drawing app — see [ADR 0001](0001-local-only-persistence.md).

**How to apply:** when writing a new ticket that adds UI, place it in the left sidebar (a tool/canvas control) or right panel (a Pattern-level/cross-cutting view) per this convention, and don't add chrome modeled on generic drawing-app features that aren't part of bd-beads' scope.

**Considered options**: letting each new feature ticket place its own controls ad hoc (rejected — already caused rework once layout needed reorganizing, see ticket 14); adopting the full feature set of reference drawing apps for future-proofing (rejected — adds unused surface area to a personal single-user tool with a narrow, fixed domain).
