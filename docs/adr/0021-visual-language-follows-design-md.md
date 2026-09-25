# The app's look and layout follow DESIGN.md: two themes, one scrolling left column, the canvas box fills the rest

The first visual design (ticket 02: flat navy/peppermint color-blocking, thick outlines) grew by accretion, and every
layout change since has been its own ADR amendment (0004 and 0005 carry eleven between them). For the MVP's "real
design system" ([ADR 0014](0014-mvp-stays-local-only-hosted-phase-deferred.md)) we rendered 72 editor prototypes, one
per published design system (tickets 125–134). The user picked five and combined parts of them into one design
(ticket 135), approving it as two screenshots. **[DESIGN.md](../../DESIGN.md) at the repo root is now the single
reference for tokens, layout and components**, and `docs/design/light.png` and `dark.png` are the approved pictures.
UI work follows it. A need it doesn't cover is added to DESIGN.md first, not invented in a component.

The decisions a later reader might not expect:

- **A dark theme as well as light.** It follows the device's setting until the user picks one with the header toggle.
  Both themes are complete token sets with the same layout. PNG and PDF exports always use the light theme.
- **One left column, scrolling on its own**, holding four separate boxes in a fixed order: Toolbox, save box, Beads
  needed, Saved Patterns. The below-canvas panel is gone. The canvas box takes all the remaining width and full
  height, and the page itself no longer scrolls: the Pattern scrolls inside the canvas box.
- **Save and Export leave the Toolbox** for a save box of their own, second in the column. Export (QR, PNG, PDF) is a
  menu there.
- **The Progress bar is always along the canvas box's bottom edge**, and it holds every Row progress control:
  - a switch that turns Row progress on and off;
  - the row readout;
  - Turn row direction;
  - Row not done (formerly Previous row);
  - Row done.

  The Toolbox's Row progress group is removed. The Pattern-shape placement (a side column for tall Patterns, a row for
  wide ones) is dropped: the bar has to be visible while Row progress is off, because its switch is how it's turned
  on.
- **Saved Patterns shows the 5 most recently saved Patterns** and expands to all. This needs a last-saved order,
  which the Pattern library (CONTEXT.md: "a flat set with no ordering") doesn't have yet. The ticket that builds this
  box adds the order.
- **Fonts are bundled with the app**, not loaded from a font CDN, so it works offline and makes no third-party
  requests ([ADR 0001](0001-local-only-persistence.md)). DM Mono and Instrument Serif have no Cyrillic, so the
  Russian UI falls back to JetBrains Mono and Source Serif 4 for those glyphs.

**Considered options**:
- Keep ticket 02's look and restyle piecemeal. Rejected: the redesign is an MVP goal, and piecemeal changes are how
  0004 and 0005 accumulated their amendments.
- Adopt one published design system wholesale. Rejected: none fitted an editor. Each was built for marketing pages,
  and the user preferred parts of five.
- Keep the below-canvas panel and a right column. Rejected in review: it split the chrome across three places and
  squeezed the canvas; one column leaves the Pattern the whole width.
- Render only one theme. Rejected: the user wanted both.

**Consequences.**
- This amends [ADR 0004](0004-three-panel-app-shell.md) (regions) and [ADR 0005](0005-tools-above-canvas.md)
  (Toolbox contents, Progress bar placement). Until the implementation tickets land, the code still follows them.
  Each ticket updates the ADRs' and CONTEXT.md's wording for the part it changes (Toolbox, Tool group, Progress bar,
  Pattern shape, Pattern library).
- The bead look changes (a board behind the beads, per-theme colors, light finished rows fading toward the board
  instead of greying). [ADR 0018](0018-pattern-drawn-by-one-renderer-not-a-dom-cell-per-bead.md)'s "the look does
  not change" was about the move to the renderer. The renderer's reference images are regenerated for the new look
  once, deliberately, and are held to the new look from then on.
- Parts of DESIGN.md marked "Derived" (messages, modals, menus, hover and focus states, Row progress off) were not in
  the approved screenshots. They can be revised without a new ADR, as long as DESIGN.md is updated with them.
