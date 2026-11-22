---
name: bd-implement
description: "Implement a piece of work based on a spec or set of tickets."
disable-model-invocation: true
---

Implement the work described by the user in the spec or tickets.

If the arguments start with `-bulk` (`/bd-implement -bulk 0692-0695`), this is a batch: follow `.claude/skills/bd-implement-bulk/SKILL.md` with the rest of the arguments, and nothing below applies to you directly (it is what each ticket's sub-agent follows).

Start with the `bd-worktree` skill: it removes the stale worktrees and sets up this work's own, where everything below happens.

Use /bd-tdd where possible, at pre-agreed seams.

Run typechecking regularly and single test files regularly. At the end, and again before opening the PR, run the checks `CLAUDE.md`'s Context hygiene gives for each moment: the related tests, the check before pushing, the full suite before the PR.

Once done, use /bd-review to review the work. Every item of its `## Needs your call` goes, as it stands, into what your final message leaves for a human.

A user-facing change adds one Release note with its kind, by the rules in `docs/agents/pull-requests.md` (Release notes): a `fix` PR's note is Fixed, the bigger kind wins, and before a note is New ask the owner (say what the maker can now do); a no makes it Changed. In a bulk run you can't ask: open the PR with the note as New, and put `New needs the owner's yes: <what the maker can now do>` as the first line of your report, so the orchestrator asks before it merges. Never name a Version in the title or the ticket.

`npm run test:full` runs the whole visual check too. Settle every visual failure before the first push, never by pushing to see what CI says: a look the work meant to change gets its references remade with `npm run visual:update` (CI's own Linux container, never macOS's Chromium), each changed image read, and committed in the same commit as the change; any other failure is a bug to fix (`docs/testing.md`, Visual baselines). If the machine skipped the full suite, say so in the final message.

Once the PR is open, you are done: don't watch its CI. No `gh pr checks --watch`, no subscribing to the PR's activity, no scheduled check-ins, no PR comments about CI. The user watches CI and comes back to you if it fails (then read it with `bash scripts/ci-failures.sh <number>`, fix and push). Watching CI is only for a bulk run, which merges its PRs in order once they are green (`bd-implement-bulk`).

Commit your work to the ticket's branch, in its worktree (`bd-worktree`), never on `main`.

End your final message with a `Skills used:` line listing every skill you invoked during the implementation (e.g. `bd-tdd`, `bd-review`), or `none`.

When a PR was opened, put its link on its own line right after the `Skills used:` line. Then the PR needs no mention anywhere above it (no number, no link), unless the prose itself needs to refer to it.
