# The repository is public, licensed AGPL-3.0-or-later

**Status: accepted.** Tickets 268, 269, 271.

The code is public: the app is client-only with no secrets in its source ([ADR 0001](0001-local-only-persistence.md)), and a public repository gets free Actions minutes and visibility. It is copyleft with a network clause because the app is served, not distributed: a permissive license, or the GPL, would let someone host a modified closed copy as a competing service, which AGPL §13 forbids (a hosted modified version must offer its users the modified source).

- **AGPL-3.0-or-later**, so a future AGPL version applies without an ADR to adopt it. `LICENSE` holds the full text; `package.json`'s `license` says so.
- **The app links to its source** from the Menu, so a user of a hosted copy finds it without the README.
- **Issues are welcome; pull requests are not yet accepted**, as no contribution process exists. Revisit when one does.
- Every runtime dependency (`vue` MIT) and the bundled fonts (SIL Open Font License) are compatible. The icons, logo and favicon are original work for this project and carry the repository's license.
- The history was rewritten into a new repository before going public, to remove personal data (ticket 268).

**Considered options**: staying private (rejected: nothing left to protect); MIT (rejected: a closed hosted fork could compete without sharing its changes); GPL-3.0 (rejected: a hosted app is never distributed, so it never triggers).
