# The repository is public, licensed AGPL-3.0-or-later

**Status: accepted.** Supersedes the "private and proprietary" framing in [ADR 0022](0022-self-hosted-deploy-to-the-flint-2-over-tailscale.md) (not its hosting mechanism, which stands). Ticket 269.

## Context

The repository was private and the code proprietary (ticket 64; ADR 0022's opening line). Going public (ticket 271) removes the one thing that reasoning rested on: ADR 0022 chose the Flint 2 router over GitHub Pages because Pages on a private repo needs a paid plan. On a public repo that constraint is gone, though the router stays the deploy target for its own reasons (no paid service, host-agnostic workflow) — this ADR only retires the "private and proprietary" half of ADR 0022's context, not the hosting decision.

Reasons to go public and pick a copyleft license:

- GitHub Actions minutes are free on public repositories (ADR 0029 already keeps CI minimal for the private-repo quota; public removes the quota concern entirely).
- The app is a client-only SPA with no server and no secrets in its source ([ADR 0001](0001-local-only-persistence.md)); there is nothing in the client code that needs to stay closed.
- A permissive license (MIT/Apache) would let someone host a modified, closed copy of the app as a competing service. The app is served over a network ([ADR 0022](0022-self-hosted-deploy-to-the-flint-2-over-tailscale.md)), which is exactly the case the AGPL's network clause (§13) targets: a hosted modified version must offer its users the modified source.

## Decision

- License: **AGPL-3.0-or-later**. `-or-later` (rather than `-only`) so the project automatically picks up a future AGPL version the FSF publishes, rather than needing an ADR just to adopt it.
- `LICENSE` holds the full AGPL-3.0 text with a copyright line for the project at the top. `package.json`'s `license` field is `AGPL-3.0-or-later`; `private: true` is dropped.
- `README.md` describes the project as open source under AGPL-3.0, with issues welcome and pull requests not yet accepted (no contribution process exists yet; revisit when one does).
- The app links to its source (`https://github.com/czAAA/bd-beads`) from the header menu, so a user of the hosted copy can find it without reading the README — the AGPL's own point.
- Dependency and asset audit (all compatible with AGPL-3.0, no conflicts found):
  - Runtime dependencies: `vue` (MIT), `qrcode` (MIT), `jsqr` (Apache-2.0) — permissive licenses, freely usable in an AGPL work.
  - Build-only devDependencies are not distributed in `dist/` and are not a licensing concern.
  - Bundled fonts (Inter, DM Mono, Instrument Serif, JetBrains Mono, Source Serif 4): SIL Open Font License, already noted in `DESIGN.md` §4.4 — OFL explicitly permits bundling.
  - Icons, logo and favicon artwork in `docs/design/system/`: original work made for this project (DESIGN.md's "nothing borrowed" principle; ADR 0030, the repo owns the design system), so it carries the repository's own AGPL-3.0 license, not a separate one.
- `CONTEXT.md`, `CLAUDE.md` and `docs/agents/` had no wording assuming a private repository to begin with; nothing to change there.

## Considered options

1. **Stay private.** Rejected: the GitHub Pages cost, wasted CI quota, and reduced visibility had no upside once there was nothing left to protect.
2. **Public under a permissive license (MIT).** Rejected: lets a closed, hosted fork compete without ever sharing its changes — the opposite of what going public is for here.
3. **Public under GPL-3.0 (no network clause).** Rejected: GPL's copyleft only triggers on distributing the software itself; a hosted SPA is served, not distributed, so a modified closed copy of a hosted app would never trigger it. AGPL's §13 closes exactly that gap.
4. **Public under AGPL-3.0-or-later (chosen).**

## Consequences

- ADR 0022's "the repository is private and proprietary (ticket 64)" and "nothing paid is wanted" framing no longer hold as reasons for anything beyond the router choice itself; this ADR is linked from there.
- Anyone can read, fork and self-host the app; anyone who hosts a modified copy over a network must offer that copy's source to its users.
- No contribution process exists yet (CI runs nothing on pull requests per ADR 0029, which assumed a trusted single contributor) — a future ADR can revisit that if outside contributions are accepted.
