# 363: Every ADR says what is decided today

**What to build:** A review of every ADR against the code and against what has been decided since: stale ADRs rewritten in place, amendments folded into the decision they changed, decisions that never got an ADR written, and conceptual mismatches between ADRs settled by grilling. Agents read the ADRs before touching an area, so an ADR that describes old code, or two ADRs that disagree, sends them the wrong way.

**Blocked by:** None (can start immediately)

**Status:** done

- [x] Each ADR rewritten in place to the current decision, with no amendment notes (`docs/agents/domain.md`, Writing ADRs)
- [x] Topics folded together: 0004 and 0005 into 0021; 0008 into 0007; 0017 into 0026 and 0007; 0023 and 0024 (feature folders) into 0020; 0025 into 0002; 0024 (Polar) and the hosted parts of 0015 and 0020 into 0014; Undo's session model into 0036
- [x] Deleted: 0003 (GitHub Pages), 0013 (review guidance, not a decision), 0015 (QR sharing, removed by ticket 364), 0029 and 0032 (CI; the facts are in `docs/testing.md`, CI). The duplicate numbers 0024 and 0032 are gone with them
- [x] New: 0038 Techniques, 0039 languages, 0040 the Overview, 0041 `features.ts` toggles, 0042 Pen and Mouse mode, 0043 hand-written PNG and PDF
- [x] Settled by grilling: the product (0001), the hosted phase and what Guests, Free accounts and Pro get (0014), View links expire 3 days after the last open (0037), the Palette's Color catalog (0002, 0007), more languages, left-to-right only (0039), the 1024px split stays and nothing needs hover (0032)
- [x] Citations of deleted ADRs in `src/`, the docs and open tickets point at what replaced them; archived tickets are untouched
- [x] CONTEXT.md: Guest, Free account, Pro, Bead color and Color catalog added; View link, Edit link and Bead corrected
- [x] The 0022 runbook moved to `docs/deploy.md`
- [x] Open tickets in line: 71, 78, 81, 84 and 323 rewritten; 85 deleted; 341 and 351 no longer mention QR
- [x] New tickets for what the code still has to catch up: 364 (remove QR), 365 (Mirror flag), 366 (Color catalog), 367 (hosting research), 368 (more languages)
- [x] The ticket is archived in the same change

Left out: ticket 69 (offline and installable) and the Tour (80) are untouched; what ships in the first release is still undecided, so no ADR lists release scope. The legacy view-only `rotation` field in `domain/project.ts` still carries a comment calling Rotate view-only; it describes the legacy field and was left for the code's own cleanup.
