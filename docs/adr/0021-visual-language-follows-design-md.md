# The app's look and layout follow the design system: three themes, one left column, the canvas box fills the rest

**Status: accepted.** Tickets 14, 125–135, 141–148, 156. Layout detail: `docs/layout.md`; the phone layout: [ADR 0032](0032-everything-under-1024px-is-the-phone-layout.md).

The **bd-beads design system** (`docs/design/system/`, owned by the repo, [ADR 0030](0030-the-repo-owns-the-design-system.md)) is the single reference for tokens, layout, components, copy and artwork, and every UI change follows it. It came from 72 editor prototypes, one per published design system; the user combined parts of five into one design, approved as `docs/design/light.png` and `dark.png`. **[DESIGN.md](../../DESIGN.md)** is its entry point: which source wins, where each topic lives, and the app-specific notes. It restates no token value or component spec, so the two can't drift.

The decisions a later reader might not expect:

- **Three themes: light, dark and high contrast**, complete token sets with one layout. The app follows the device (`prefers-color-scheme`, `prefers-contrast: more`) until the person picks one. PNG and PDF exports always use the light theme.
- **From 1024px, one left column that scrolls on its own**, with separate boxes in a fixed order: Toolbox, save box, Beads needed, Saved Projects. The canvas box takes the rest of the width and the full height. The page itself never scrolls; nothing sits below the canvas.
- **Zoom sits in the canvas box's header strip; the Progress bar runs along its bottom edge** and holds every Row progress control, its on/off switch included, so it shows even while Row progress is off.
- **Save and Export have a save box of their own**, second in the column, with Export as a menu.
- **Saved Projects shows the most recently saved first**, five (ten on the desktop) with a way to show all.
- **Fonts are bundled**, not loaded from a font CDN, so the app works offline and makes no third-party requests. The bundled fonts cover Latin and Cyrillic ([ADR 0039](0039-languages-and-how-they-are-written.md)).
- **No chrome borrowed from general drawing apps**: no gallery, layers panel, object library, animation, or clone/flip/shadow controls. bd-beads is a tool for one domain, and a feature gets a place in the layout only when it exists.

**Considered options**: restyling the first look piecemeal (rejected: that is how the layout ADRs piled up a dozen amendments); adopting one published design system wholesale (rejected: none fitted an editor); a below-canvas panel and a right column (rejected: it split the chrome across three places and squeezed the canvas); one theme (rejected: the user wanted light and dark, and high contrast followed); ticket 02's first layout of a main panel and panels above and below the canvas (replaced: the tools moved next to the canvas and then into the column, as the controls grew).
