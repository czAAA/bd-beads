# 358: Give agents a coding standards doc and a clean repo to search

**What to build:** Make the skill loop (`grill-with-docs`, `to-spec`, `to-tickets`, `implement`, `code-review`) work from complete, unambiguous docs and a repo where search and ticket listing only find what is current. Today `code-review`'s Standards check finds no standards file and falls back to generic code smells. Stale copies of tickets that are already archived look like open work. A worktree nested inside the repo doubles every search result. `CONTEXT.md` still has template stubs. Two ADR numbers are each used twice.

**Blocked by:** None (can start immediately)

**Status:** ready-for-human (the deletions below need the maintainer's go-ahead; the docs work is agent-ready)

### Docs

- [ ] A `CODING_STANDARDS.md` at the repo root (the name `code-review` looks for), about 60 lines. It points to the ADRs instead of repeating them and covers: which layer and feature folder new code goes in (ADR 0020, 0023, 0024); every undoable change goes through `edit` (ADR 0036); controls come from the shared components and the control registry (ADR 0035); every user-facing string goes in both EN and RU; no hardcoded colors, fonts, sizes or shadows (role-named tokens, `DESIGN.md`); naming and comment density; which rules ESLint already enforces, so reviewers skip them
- [ ] A testing section in the same file (or a linked doc): the shared test helpers, testing at the highest existing seam, prior-art test files to copy, the stored-data compatibility fixtures, and when to update visual baselines on purpose and how
- [ ] `CLAUDE.md` links to `CODING_STANDARDS.md` and says outright that "never run the full suite by hand" overrides the `implement` skill's "full test suite once at the end"
- [ ] `CONTEXT.md`: "How to run it" is filled in (or links to README's Checks); "Where to start" is a short map of `src/` (domain, rendering, services, the per-feature composables and components, the UI primitives, i18n, theme, overview) and the key entry files
- [ ] `CONTEXT.md`'s Key concepts holds only domain language: the test-tooling detail in "Text fit check" and the layout detail in "App shell layout" move to a testing doc or a layout doc, with a one-line glossary entry and link left in their place
- [ ] Every ADR number is unique: one of each 0024 pair and one of each 0032 pair is renumbered (next free numbers), and every reference in `CLAUDE.md`, `CONTEXT.md`, `DESIGN.md`, the README, other ADRs, `eslint.config.js` comments and code comments points to the right one
- [ ] `docs/agents/issue-tracker.md` documents the ticket format in use (heading `# NN: Title`, What to build, Spec, Blocked by, Status, checklist), says how to pick the next number (highest across `.scratch/`, `.archive/` and branch names, plus one), and says tickets stay flat as `.scratch/NN-slug.md`, not in per-feature folders

### Cleanup (each needs the maintainer's go-ahead)

- [ ] The untracked ticket files in `.scratch/` that duplicate a ticket in `.scratch/.archive/` (233–265, 295–321, 327–335) are compared with their archived copies; anything only in the stray copy is reported, then the strays are deleted
- [ ] The worktree nested inside the repo (`bd-beads-346/`, merged in #92) is removed with `git worktree remove`; sibling worktrees whose branches are merged are listed for the maintainer to prune
- [ ] Statuses of the open tickets match reality (for example 337–342 are `needs-triage` while 337–340 already have worktrees)
- [ ] The loose root files are dealt with: `m.sh` (one-time migration script) is deleted or moved out of the repo; `hover-text-audit.md` (read from an old branch, now stale) is deleted or moved to `docs/research/` with its date and source branch in the first line
- [ ] Optional: `/fewer-permission-prompts` adds a read-only allowlist to `.claude/settings.json`

### Done when

- [ ] A search for any ADR number or ticket number returns one match
- [ ] Listing `ready-for-agent` tickets returns no archived work
- [ ] A dry `code-review` run names `CODING_STANDARDS.md` as a standards source
