# 379: Agent sessions in this repo read less by default

**What to build:** Cut the tokens an agent spends per session: the stale review skill name is fixed, archived tickets stay out of search and reads, and one quiet command runs the cheap pre-push checks. Splitting CONTEXT.md's glossary and cheaper review subagents are left for their own tickets.

**Blocked by:** None (can start immediately)

**Status:** done

- [x] CLAUDE.md names `/code-review main`, not the removed `/mattpocock-skills:code-review`
- [x] `.ignore` hides `.scratch/.archive/` from ripgrep and the Grep tool; `.claude/settings.json` denies `Read` on it
- [x] `npm run check` runs typecheck, lint and knip, prints one line per step, and the last 40 lines only for a failing step
- [x] CLAUDE.md Context hygiene tells agents about the check command, the hidden archive and grepping CONTEXT.md's glossary
