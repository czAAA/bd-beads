# The repo owns the design system; claude.ai is a copy updated only when needed

**Status: accepted.** Amends [ADR 0021](0021-visual-language-follows-design-md.md): the design system is still the reference for every UI change, but it is no longer edited on claude.ai first. Ticket 273. Amended: the claude.ai project is not frozen; it is a copy that gets a change back from the repo only when it needs one.

## Context

ADR 0021 made the bd-beads design system, edited on claude.ai and copied into `docs/design/system/`, the single reference for tokens, specs, copy and artwork. Every need it didn't cover waited for an edit on claude.ai and a re-sync. Over v16 to v18 that loop kept the repo and the design system apart: ticket 250 and ticket 261 shipped a Toolbox and a margin band that v18 then described differently, the app's deliberate choices (zoom order, an icon-only BottomToolbar, no Mirror in the Dock) never made it back to the cards, and the repo held hand-written cards and tokens "until the next sync" (`canvas-bg-*`, `bead-min-*`, Rulers). The design is now changed far more often in code than in the claude.ai tool, so the copy in the repo is the one that is true.

## Decision

- `docs/design/system/` is the source of the design system. Change it in place, in the same commit as the code it describes: the card's `README.md`, `tokens.json` and `tokens.css`, `components/bundle.css`, and `src/styles/design-values.css` (DESIGN.md §4.6).
- v18, synced on 2026-10-04, is the baseline. Nothing is synced from claude.ai into the repo. A change is copied back out to the claude.ai project only when that copy needs it, one way, from the repo. The README's Version section carries a changelog of repo changes after v18, one line each with the ticket number.
- ADR 0021 still holds: UI follows the design system, with role-named tokens and no hand-typed colors, sizes or shadows. What changes is where a missing piece is added: in the design system files, in the repo, not on claude.ai first.
- The icons, logo and favicon files stay as they are in `docs/design/system/`; a new icon is added there, drawn in the same style.

## Considered options

1. **Keep claude.ai as the source and sync more often.** Rejected: every code-side change needs a round trip to a tool that can't run the app, and the drift above came from exactly that.
2. **Drop the design system folder and keep only DESIGN.md and the code.** Rejected: the cards, tokens and writing guide are what agents read before touching UI; they are worth keeping, and they need to stay true.
3. **The repo owns it (chosen).** One place to change, reviewed with the code that needs it.

## Consequences

- DESIGN.md §2 and §6 and the Design paragraph of `CLAUDE.md` say "edit in place". The `docs/design/system/README.md` is no longer generated, so its stale lines (the `api/` pointers, "Not synced") can be tidied by hand.
- A pull request that changes how something looks or reads updates its card in the same change; a card that disagrees with the app is a bug in one of them.
- Copying a change back to claude.ai is optional and one way. Taking claude.ai's version into the repo again would be a deliberate re-import with a diff, not a sync.
