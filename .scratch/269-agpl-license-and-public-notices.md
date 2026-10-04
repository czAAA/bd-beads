# 269: AGPL-3.0 license and public-facing notices

**What to build:** The repository is licensed AGPL-3.0, and nothing in it still says it is private, proprietary or confidential. Anyone who uses the hosted app can find its source, as the AGPL requires for software served over a network.

**Blocked by:** None (can start immediately).

**Status:** ready-for-agent

- [ ] The license file holds the AGPL-3.0 text with the copyright line; the package metadata names `AGPL-3.0-only` (or `-or-later`, chosen and recorded in the ADR) and is no longer marked unlicensed
- [ ] Every dependency's license and every bundled asset's license is AGPL-compatible: fonts (OFL, license files already shipped), the design system's icons and artwork. Any conflict is listed and resolved
- [ ] The README describes the project as open source under AGPL-3.0, drops "private repository" and "proprietary", and says whether outside contributions are accepted (default: not yet; issues welcome)
- [ ] The app links to its source code from a place users can reach (e.g. an About or footer link), built from the design system's existing components and copy rules; anything not covered there goes to the design system first (`DESIGN.md` §6)
- [ ] A new ADR records the switch to a public AGPL-3.0 repository and why (free CI minutes, nothing to protect in client-side code, the AGPL stops closed hosted copies), and notes which parts of ADR 0022's "private and proprietary" reasoning it supersedes; ADR 0022 links to it
- [ ] `CONTEXT.md`, `CLAUDE.md` and `docs/agents/` hold no wording that assumes the repository is private
