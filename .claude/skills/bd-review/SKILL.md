---
name: bd-review
description: "Review and fix the current work (uncommitted changes plus commits, or the open PR) against origin/main, with no arguments needed. Two axes in parallel sub-agents: Standards (documented coding standards, smells, tests) and Spec (the originating ticket or session goal). Then fixes every clear finding and leaves the judgement calls to the user. Use when the user wants to review a branch, a PR or work in progress."
---

Two-axis review of the current work against `origin/main`, then fix what is clearly wrong. The user supplies nothing.

- **Standards**: does the code conform to this repo's documented coding standards?
- **Spec**: does the code faithfully implement the originating ticket / spec?

Both axes run as **parallel sub-agents** so they don't pollute each other's context. A diff that touches only docs or config is reviewed inline, without sub-agents.

## Process

### 1. Capture the diff

The fixed point is always `origin/main`, never local `main`. Run `git fetch origin main` first.

The work is everything since the merge-base, committed or not, so one command covers a branch, a PR and work in progress. Save the untracked list (`git ls-files -o --exclude-standard`), run `git add -N -- <those files>` so new files show up, then `git diff $(git merge-base HEAD origin/main)`. If an untracked file looks accidental or holds secrets (`.env*`, logs, `test-results/`), leave it out and say so. List commits with `git log origin/main..HEAD --oneline`.

Confirm the ref resolves and the diff is non-empty. Fail here, not inside the sub-agents. If a PR is open for the branch (`gh pr view`), its description is spec material, and its title must match `type:[NNNN] Description` (`docs/agents/pull-requests.md`): a mismatch is a hard finding.

### 2. Find the spec

First hit wins:

1. The ticket number in the PR title `[NNNN]`, the worktree name `bd-beads-<ticket>`, or the commit messages, fetched per `docs/agents/issue-tracker.md`. An open PR's ticket may already be archived: look in `.scratch/.archive/` with `ls` (search skips it).
2. A ticket or spec under `.scratch/` or `docs/specs/` matching the branch name or feature.
3. This session's goal or `bd-implement` prompt.
4. Nothing found: ask once. If there is none, skip the Spec sub-agent and say "no spec available".

### 3. Find the standards

`CODING_STANDARDS.md` and `docs/testing.md`. The Standards axis always also carries the baseline in `smells.md` (next to this file), applied even when a repo documents nothing. Read it now. Two rules bind it:

- **The repo overrides.** A documented standard wins (e.g. deep modules over small interfaces); suppress a smell the repo endorses.
- **Smells are judgement calls**, labelled as such ("possible Feature Envy"). Skip anything tooling already enforces.

### 4. Spawn both sub-agents in parallel

Start them on `model: sonnet`. Give each only the diff command, commit list and the files below, so they don't search for them.

**Standards**: the paths of `CODING_STANDARDS.md` and `docs/testing.md`, plus the contents of `smells.md` pasted in full (the sub-agent has no other access). Brief: "Report per file/hunk: (a) every violation of a documented standard, citing file and rule; (b) any baseline smell, named, with the hunk quoted; (c) for each test the diff adds, whether it is FIRST and worth having (flag overtesting as firmly as missing tests). Label each finding **hard** (a documented-standard breach, or an unambiguous bug) or **judgement** (every smell, and anything you are unsure of). If the diff changes files in `e2e/visual/__screenshots__/`, read each changed image (crop it first) and say whether the change is the one the ticket asks for; an unexplained difference is **hard**. Skip anything tooling enforces. Under 400 words."

**Spec**: the ticket or spec path (or its contents, if it came from the session). Brief: "Report: (a) requirements missing or partial; (b) behaviour not asked for (scope creep); (c) requirements that look implemented but wrongly. Quote the spec line for each. Label each **hard** or **judgement**. Under 400 words."

### 5. Report, then fix

Present the reports under `## Standards` and `## Spec`, verbatim or lightly cleaned. Don't merge or rerank: the axes are separate on purpose (a change can pass one and fail the other).

Then fix:

- **Check each finding against the code first**; drop the false ones and say which.
- **Fix every `hard` finding**, then every `judgement` finding that is plainly right on reading the code (an obvious magic literal, a duplicate of an existing helper, a test that asserts nothing).
- **Never delete behaviour or build a missing feature as a fix**, whatever its label: scope creep and missing requirements go to the user.
- **Leave alone** anything where it is hard to say whether it is an issue: most smells, design trade-offs, scope creep that might be wanted, a missing test of doubtful value. List these for the user under `## Needs your call`, one line each, with the reason it's unclear.
- Run `npm run check` and `npm run test:related -- <changed files>` after the fixes. If a fix breaks them and the cause isn't obvious, revert that fix and list it under `## Needs your call`.
- Don't commit or push; the caller does. Undo step 1's `git add -N` on files still uncommitted (`git reset -q -- <files>`), so the index is as you found it.

End with one line: findings per axis, how many fixed, how many left for the user.
