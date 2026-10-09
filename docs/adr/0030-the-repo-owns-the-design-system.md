# The repo owns the design system; claude.ai is a copy updated only when needed

**Status: accepted.** Ticket 273.

The design system ([ADR 0021](0021-visual-language-follows-design-md.md)) was first edited on claude.ai and copied into the repo. Every need it didn't cover waited for an edit there and a re-sync, and over v16 to v18 the two drifted apart: shipped choices never reached the cards, and the repo held hand-written cards and tokens "until the next sync". The design changes far more often in code than in that tool, so the repo's copy is the true one.

- **`docs/design/system/` is the source.** Change it in place, in the same commit as the code it describes: the card's `README.md`, `tokens.json` and `tokens.css`, `components/bundle.css`, and `src/styles/design-values.css` (DESIGN.md §6). A pull request that changes how something looks or reads updates its card; a card that disagrees with the app is a bug in one of them.
- **v18, synced on 2026-10-04, is the baseline.** Nothing is synced from claude.ai into the repo. The README's Version section carries a changelog of repo changes since, one line each with its ticket.
- **claude.ai gets a change only when it needs one**, copied out from the repo, one way. Taking claude.ai's version into the repo again would be a deliberate re-import with a diff, not a sync.
- Icons, logo and favicon come from `docs/design/system/`; a new icon is added there, drawn in the same style.

**Considered options**: keeping claude.ai as the source and syncing more often (rejected: every code-side change needs a round trip to a tool that can't run the app); dropping the design system folder for DESIGN.md and the code (rejected: the cards, tokens and writing guide are what agents read before touching UI).
